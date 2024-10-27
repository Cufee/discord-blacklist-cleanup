import { Result } from "./main.ts";

export interface Profile {
  user: User;
  mutual_guilds: MutualGuild[];
}

interface MutualGuild {
  "id": string;
}

export interface User {
  "id": string;
  "username": string;
  "global_name": string;
  "avatar": string;
  "discriminator": string;
  "public_flags": number;
}

export interface Relation {
  "id": string;
  "type": number;
  "nickname": string;
  "user": User;
  "is_spam_request": boolean;
  "since": string;
}

export class Discord {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  updateToken(token: string): Promise<boolean> {
    this.token = token;
    return this.validateToken();
  }

  async fetch<T>(endpoint: string, method = "GET"): Promise<Result<T>> {
    try {
      const res = await fetch(`https://discord.com/api/v9${endpoint}`, {
        headers: {
          "authorization": this.token,
        },
        method,
      });
      console.debug(`${method} request to ${endpoint} - ${res.status}`);
      if (res.status === 429) {
        return {
          ok: false,
          error: "too many requests",
          context: res.headers.get("Retry-After"),
        };
      }
      if (res.status === 401) {
        return { ok: false, error: "unauthorized" };
      }
      if (res.status === 404) {
        return { ok: false, error: "not found" };
      }
      if (res.status > 299) {
        return { ok: false, error: res.statusText, context: res.status };
      }
      const data = await res.json();
      return { data, ok: true };
    } catch (error) {
      return { ok: false, error: error.toString() };
    }
  }

  async validateToken(): Promise<boolean> {
    const res = await this.fetch("/users/@me");
    return res.ok;
  }

  async getRelationships(): Promise<Result<Relation[]>> {
    const res = await this.fetch<Relation[]>("/users/@me/relationships");
    return res;
  }

  async deleteRelationship(id: string): Promise<Result<null>> {
    const res = await this.fetch<null>(
      `/users/@me/relationships/${id}`,
      "DELETE",
    );
    return res;
  }

  async getUserProfile(userId: string): Promise<Result<Profile>> {
    const res = await this.fetch<Profile>(
      `/users/${userId}/profile?with_mutual_guilds=true`,
    );
    return res;
  }
}
