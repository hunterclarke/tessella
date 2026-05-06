defmodule ApiWeb.TrackedObjectsController do
  use ApiWeb, :controller

  def index(conn, _params) do
    json(conn, Api.Celestrak.tracked_objects())
  end

  def show(conn, %{"id" => id}) do
    with {id, ""} <- Integer.parse(id),
         object when not is_nil(object) <- Api.TrackedObjectsFeed.fetch_state(id) do
      json(conn, object)
    else
      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{error: reason})

      {_id, _rest} ->
        conn |> put_status(:bad_request) |> json(%{error: "Invalid ID format"})

      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Object not found"})
    end
  end

  def passes(conn, %{"id" => id} = params) do
    with {cat_id, ""} <- Integer.parse(id),
         {:ok, station} <- station_from_params(params),
         {:ok, opts} <- opts_from_params(params),
         {:ok, passes} <- Api.PassPrediction.predict(cat_id, station, opts) do
      json(conn, passes)
    else
      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{error: reason})

      {_id, _rest} ->
        conn |> put_status(:bad_request) |> json(%{error: "Invalid ID format"})
    end
  end

  defp station_from_params(params) do
    with {latitude, ""} <- Float.parse(Map.get(params, "latitude")),
         {longitude, ""} <- Float.parse(Map.get(params, "longitude")),
         {altitude_m, ""} <- Float.parse(Map.get(params, "altitude_m")) do
      {:ok, %{latitude: latitude, longitude: longitude, altitude_m: altitude_m}}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp opts_from_params(params) do
    with {min_elevation, ""} <- Float.parse(Map.get(params, "min_elevation", "10")),
         {hours, ""} <- Integer.parse(Map.get(params, "hours", "24")) do
      {:ok, [min_elevation: min_elevation, hours: hours]}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
