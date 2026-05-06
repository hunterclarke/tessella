defmodule Api.Celestrak do
  use GenServer
  require Logger

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def tracked_objects do
    GenServer.call(__MODULE__, :tracked_objects)
  end

  def tracked_object_record(cat_id) do
    GenServer.call(__MODULE__, {:tracked_object_record, cat_id})
  end

  def tracked_object_records do
    GenServer.call(__MODULE__, :tracked_object_records)
  end

  @impl true
  def init(_opts) do
    state = %{
      loaded_at: nil,
      tracked_objects: []
    }

    {:ok, load_data(state, "active")}
  end

  @impl true
  def handle_call(:tracked_objects, _from, state) do
    {:reply, Enum.map(state.tracked_objects, &public_object/1), state}
  end

  @impl true
  def handle_call({:tracked_object_record, cat_id}, _from, state) do
    object =
      Enum.find(state.tracked_objects, fn obj -> obj.cat_id == cat_id end)

    {:reply, object, state}
  end

  @impl true
  def handle_call(:tracked_object_records, _from, state) do
    {:reply, state.tracked_objects, state}
  end

  defp load_data(state, source) do
    with {:ok, records} <- load_tle_data(source) do
      %{state | tracked_objects: records, loaded_at: DateTime.utc_now()}
    else
      {:error, reason} ->
        Logger.error("Failed to load data: #{reason}")
        state
    end
  end

  defp load_tle_data(source) do
    path = Application.app_dir(:api, "priv/data/#{source}.tle")

    case File.read(path) do
      {:ok, content} ->
        records =
          content
          |> String.split("\n", trim: true)
          |> Enum.chunk_every(3)
          |> Enum.map(fn [name, line1, line2] ->
            line1 = String.trim(line1)
            line2 = String.trim(line2)
            object_name = String.trim(name)

            %{
              cat_id: cat_id_from_tle(line1),
              object_name: object_name,
              tle: %{name: object_name, line1: line1, line2: line2}
            }
          end)

        Logger.info("Successfully loaded #{length(records)} objects from #{source}.tle")

        {:ok, records}

      {:error, _reason} ->
        {:error, "Failed to load tle file"}
    end
  end

  defp cat_id_from_tle(line1) do
    [_, cat_id] = Regex.run(~r/^1\s+(\d+)/, line1)
    String.to_integer(cat_id)
  end

  defp public_object(object) do
    %{
      cat_id: object.cat_id,
      object_name: object.object_name
    }
  end
end
