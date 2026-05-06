defmodule Api.TrackedObjectsFeed do
  use GenServer
  require Logger

  @topic "tracked_objects"
  @frame_ms 5_000

  def topic, do: @topic

  def current_objects do
    GenServer.call(__MODULE__, :current_objects)
  end

  def fetch_state(cat_id) do
    GenServer.call(__MODULE__, {:fetch_state, cat_id})
  end

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    propagators =
      Api.Celestrak.tracked_object_records()
      |> Enum.flat_map(&parse_propagator/1)

    send(self(), :propagate_frame)

    {:ok,
     %{
       propagators: propagators,
       objects: %{},
       states: %{},
       tick_count: 0,
       propagated_at: nil,
       task_ref: nil
     }}
  end

  @impl true
  def handle_call(:current_objects, _from, state) do
    {:reply, Map.values(state.objects), state}
  end

  @impl true
  def handle_call({:fetch_state, cat_id}, _from, state) do
    {:reply, Map.get(state.states, cat_id), state}
  end

  @impl true
  def handle_info(:propagate_frame, %{task_ref: nil} = state) do
    propagated_at = DateTime.utc_now()
    tick_count = state.tick_count + 1

    task =
      Task.Supervisor.async_nolink(Api.PropagationTaskSupervisor, fn ->
        propagate_all(state.propagators, propagated_at, tick_count)
      end)

    {:noreply, %{state | task_ref: task.ref}}
  end

  @impl true
  def handle_info(:propagate_frame, state) do
    Process.send_after(self(), :propagate_frame, @frame_ms)
    {:noreply, state}
  end

  @impl true
  def handle_info({ref, {objects, states, propagated_at, tick_count}}, %{task_ref: ref} = state) do
    Process.demonitor(ref, [:flush])

    Phoenix.PubSub.broadcast(
      Api.PubSub,
      @topic,
      {:tracked_objects_updated, Map.values(objects)}
    )

    Process.send_after(self(), :propagate_frame, @frame_ms)

    {:noreply,
     %{
       state
       | objects: objects,
         states: states,
         tick_count: tick_count,
         propagated_at: propagated_at,
         task_ref: nil
     }}
  end

  @impl true
  def handle_info({:DOWN, ref, :process, _pid, reason}, %{task_ref: ref} = state) do
    Logger.warning("Tracked objects propagation task failed: #{inspect(reason)}")
    Process.send_after(self(), :propagate_frame, @frame_ms)
    {:noreply, %{state | task_ref: nil}}
  end

  defp propagate_all(propagators, propagated_at, tick_count) do
    states =
      propagators
      |> Task.async_stream(
        fn propagator -> propagate(propagator, propagated_at, tick_count) end,
        max_concurrency: System.schedulers_online(),
        ordered: false,
        timeout: 5_000
      )
      |> Enum.reduce(%{}, fn
        {:ok, nil}, states ->
          states

        {:ok, object}, states ->
          Map.put(states, object.cat_id, object)

        {:exit, reason}, states ->
          Logger.warning("Tracked object propagation failed: #{inspect(reason)}")
          states
      end)

    objects =
      states
      |> Map.values()
      |> Map.new(fn object -> {object.cat_id, compact_object(object)} end)

    {objects, states, propagated_at, tick_count}
  end

  defp parse_propagator(record) do
    case Orbis.parse_tle(record.tle.line1, record.tle.line2) do
      {:ok, parsed_tle} ->
        [
          %{
            cat_id: record.cat_id,
            object_name: record.object_name,
            parsed_tle: parsed_tle
          }
        ]

      {:error, reason} ->
        Logger.warning("Failed to parse TLE for #{record.cat_id}: #{inspect(reason)}")
        []
    end
  end

  defp propagate(propagator, propagated_at, tick_count) do
    with {:ok, teme} <- Orbis.propagate(propagator.parsed_tle, propagated_at) do
      gcrs = Orbis.Coordinates.teme_to_gcrs(teme, propagated_at)
      itrs = Orbis.Coordinates.gcrs_to_itrs(gcrs, propagated_at)
      geodetic = Orbis.Coordinates.to_geodetic(itrs)

      %{
        cat_id: propagator.cat_id,
        object_name: propagator.object_name,
        propagated_at: propagated_at,
        tick_count: tick_count,
        latitude: geodetic.latitude,
        longitude: geodetic.longitude,
        altitude_km: geodetic.altitude_km,
        velocity_km_s: velocity_magnitude(teme.velocity)
      }
    else
      {:error, reason} ->
        Logger.warning("Failed to propagate #{propagator.cat_id}: #{inspect(reason)}")
        nil
    end
  end

  defp compact_object(object) do
    [object.cat_id, object.latitude, object.longitude, object.altitude_km, object.velocity_km_s]
  end

  defp velocity_magnitude({vx, vy, vz}) do
    :math.sqrt(vx * vx + vy * vy + vz * vz)
  end
end
