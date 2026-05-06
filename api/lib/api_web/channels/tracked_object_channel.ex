defmodule ApiWeb.TrackedObjectChannel do
  use ApiWeb, :channel

  @impl true
  def join("tracked_object:" <> cat_id, _params, socket) do
    with {cat_id, ""} <- Integer.parse(cat_id),
         state when not is_nil(state) <- Api.TrackedObjectsFeed.fetch_state(cat_id) do
      Phoenix.PubSub.subscribe(Api.PubSub, Api.TrackedObjectsFeed.topic())
      socket = assign(socket, :cat_id, cat_id)
      {:ok, state, socket}
    else
      :error -> {:error, %{reason: "invalid_cat_id"}}
      {_cat_id, _rest} -> {:error, %{reason: "invalid_cat_id"}}
      nil -> {:error, %{reason: "not_found"}}
    end
  end

  @impl true
  def handle_info({:tracked_objects_updated, _objects}, socket) do
    state = Api.TrackedObjectsFeed.fetch_state(socket.assigns.cat_id)

    if state do
      push(socket, "state", state)
    end

    {:noreply, socket}
  end
end
