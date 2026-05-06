defmodule ApiWeb.UserSocket do
  use Phoenix.Socket

  channel("tracked_objects", ApiWeb.TrackedObjectsChannel)
  channel("tracked_object:*", ApiWeb.TrackedObjectChannel)

  @impl true
  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
