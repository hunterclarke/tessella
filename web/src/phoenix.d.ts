declare module "phoenix" {
  export class Socket {
    constructor(endpoint: string, opts?: Record<string, unknown>);
    connect(): void;
    disconnect(): void;
    channel(topic: string, params?: Record<string, unknown>): Channel;
  }

  export class Channel {
    join(): Push;
    leave(): void;
    on(event: string, callback: (payload: unknown) => void): number;
    onError(callback: () => void): number;
  }

  export class Push {
    receive(status: "ok" | "error" | "timeout", callback: (payload: unknown) => void): Push;
  }
}
