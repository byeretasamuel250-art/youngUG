// =========================================================
// Shared logic for "YoungUG"
// =========================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_KEY = "youngug_session";

// ---------- Session (name + phone only, no password) ----------

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function setSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Log in if the phone number already exists, otherwise register.
// This is the same "no password, no OTP" approach used on newplus.
async function loginOrRegister(name, phone) {
  const cleanPhone = phone.trim();
  const cleanName = name.trim();

  const { data: existing, error: findErr } = await sb
    .from("users")
    .select("*")
    .eq("phone", cleanPhone)
    .maybeSingle();

  if (findErr) throw findErr;

  if (existing) {
    if (!existing.active) {
      const err = new Error("DEACTIVATED");
      err.code = "DEACTIVATED";
      throw err;
    }
    setSession(existing);
    return existing;
  }

  const { data: created, error: insertErr } = await sb
    .from("users")
    .insert({ name: cleanName, phone: cleanPhone })
    .select()
    .single();

  if (insertErr) throw insertErr;

  setSession(created);
  return created;
}

// Re-check a logged-in user's active status (call this on app boot,
// in case an admin deactivated them since their last visit).
async function refreshUserStatus(userId) {
  const { data, error } = await sb
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data; // null if the account no longer exists
}

// ---------- Admin: users ----------

async function fetchAllUsers() {
  const { data, error } = await sb
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function setUserActive(userId, active) {
  const { error } = await sb.from("users").update({ active }).eq("id", userId);
  if (error) throw error;
}

// ---------- Admin: ads (text-only) ----------

async function fetchActiveAd() {
  const { data, error } = await sb
    .from("ads")
    .select("*")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchLatestAd() {
  const { data, error } = await sb
    .from("ads")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveAd(text, active) {
  const existing = await fetchLatestAd();
  if (existing) {
    const { error } = await sb
      .from("ads")
      .update({ text, active, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("ads").insert({ text, active });
    if (error) throw error;
  }
}

// ---------- Posts ----------

async function fetchPosts(limit = 50) {
  const { data, error } = await sb
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function createTextPost(user, content) {
  const { error } = await sb.from("posts").insert({
    user_id: user.id,
    user_name: user.name,
    type: "text",
    content: content.trim(),
  });
  if (error) throw error;
}

async function createAudioPost(user, blob, seconds) {
  const fileName = `${user.id}-${Date.now()}.webm`;

  const { error: uploadErr } = await sb.storage
    .from("audio-posts")
    .upload(fileName, blob, { contentType: "audio/webm" });
  if (uploadErr) throw uploadErr;

  const { data: publicUrlData } = sb.storage
    .from("audio-posts")
    .getPublicUrl(fileName);

  const { error: insertErr } = await sb.from("posts").insert({
    user_id: user.id,
    user_name: user.name,
    type: "audio",
    audio_url: publicUrlData.publicUrl,
    audio_seconds: Math.round(seconds),
  });
  if (insertErr) throw insertErr;
}

async function createImagePost(user, file, caption) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileName = `${user.id}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await sb.storage
    .from("post-images")
    .upload(fileName, file, { contentType: file.type || "image/jpeg" });
  if (uploadErr) throw uploadErr;

  const { data: publicUrlData } = sb.storage
    .from("post-images")
    .getPublicUrl(fileName);

  const { error: insertErr } = await sb.from("posts").insert({
    user_id: user.id,
    user_name: user.name,
    type: "image",
    content: caption ? caption.trim() : null,
    image_url: publicUrlData.publicUrl,
  });
  if (insertErr) throw insertErr;
}

async function deletePost(postId) {
  const { error } = await sb.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

// ---------- Helpers ----------

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
