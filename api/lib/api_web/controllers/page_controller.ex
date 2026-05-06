defmodule ApiWeb.PageController do
  use ApiWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end

  def web_app(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> send_file(200, Application.app_dir(:api, "priv/static/index.html"))
  end
end
