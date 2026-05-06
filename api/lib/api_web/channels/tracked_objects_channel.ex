defmodule ApiWeb.TrackedObjectsChannel do
  use ApiWeb, :channel

  @impl true
  def join("tracked_objects", _params, socket) do
    Phoenix.PubSub.subscribe(Api.PubSub, Api.TrackedObjectsFeed.topic())
    {:ok, %{objects: Api.TrackedObjectsFeed.current_objects()}, socket}
  end

  @impl true
  def handle_info({:tracked_objects_updated, objects}, socket) do
    push(socket, "frame", %{objects: objects})
    {:noreply, socket}
  end
end
