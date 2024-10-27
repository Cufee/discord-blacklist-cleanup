import { Profile } from "./discord.ts";
import { Result } from "./main.ts";

const kv = await Deno.openKv(Deno.env.get("DATABASE_PATH"));

interface ProfileCache extends Profile {
  timestamp: number;
}

export const getCachedProfile = async (
  userId: string,
): Promise<Result<ProfileCache>> => {
  const data = await kv.get<ProfileCache>(["users", "profiles", userId]);
  if (!data.value) {
    return { ok: false, error: "not found" };
  }
  return { data: data.value, ok: true };
};

export const saveProfileCache = async (
  profile: Profile,
): Promise<Result<ProfileCache>> => {
  const cache: ProfileCache = { ...profile, timestamp: Date.now() };
  const data = await kv.set(["users", "profiles", profile.user.id], cache, {
    expireIn: 1000 * 60 * 60 * 6,
  });
  if (!data.ok) {
    return { ok: false, error: "failed to save" };
  }
  return { data: cache, ok: true };
};
