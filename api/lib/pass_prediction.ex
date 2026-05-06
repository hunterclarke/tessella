defmodule Api.PassPrediction do
  def predict(cat_id, station, opts) do
    with object when not is_nil(object) <- Api.Celestrak.tracked_object_record(cat_id),
         {:ok, parsed_tle} <- Orbis.parse_tle(object.tle.line1, object.tle.line2) do
      start_time = Keyword.get(opts, :start_time, DateTime.utc_now())
      hours = Keyword.get(opts, :hours, 24)
      end_time = DateTime.add(start_time, hours, :hour)

      passes =
        Orbis.Passes.predict(parsed_tle, normalize_station(station), start_time, end_time,
          min_elevation: Keyword.get(opts, :min_elevation, 10.0),
          step_seconds: Keyword.get(opts, :step_seconds, 60)
        )

      {:ok, Enum.map(passes, &serialize_pass/1)}
    else
      nil -> {:error, :tracked_object_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp normalize_station(station) do
    %{
      latitude: station.latitude,
      longitude: station.longitude,
      altitude_m: station.altitude_m
    }
  end

  defp serialize_pass(pass) do
    %{
      rise: pass.rise,
      set: pass.set,
      max_elevation: pass.max_elevation,
      max_elevation_time: pass.max_elevation_time,
      duration_seconds: DateTime.diff(pass.set, pass.rise, :second)
    }
  end
end
