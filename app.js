// =========================================================
// App logic for index.html
// =========================================================

const loginScreen = document.getElementById("loginScreen");
const feedScreen = document.getElementById("feedScreen");
const nameInput = document.getElementById("nameInput");
const phoneInput = document.getElementById("phoneInput");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const userNameChip = document.getElementById("userNameChip");
const logoutBtn = document.getElementById("logoutBtn");

const postText = document.getElementById("postText");
const postBtn = document.getElementById("postBtn");
const micBtn = document.getElementById("micBtn");
const micBtnLabel = document.getElementById("micBtnLabel");
const audioPreviewWrap = document.getElementById("audioPreviewWrap");
const photoBtn = document.getElementById("photoBtn");
const photoInput = document.getElementById("photoInput");
const imagePreviewWrap = document.getElementById("imagePreviewWrap");
const feedList = document.getElementById("feedList");
const feedLoading = document.getElementById("feedLoading");

let currentUser = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let recordStartTime = null;
let recordedSeconds = 0;
let selectedImageFile = null;

// ---------- Boot ----------

async function boot() {
  currentUser = getSession();
  if (currentUser) {
    try {
      const fresh = await refreshUserStatus(currentUser.id);
      if (!fresh || !fresh.active) {
        clearSession();
        currentUser = null;
        showLogin("Your account has been deactivated by an admin. Contact the group admin if you think this is a mistake.");
        return;
      }
      currentUser = fresh;
      setSession(fresh);
      showFeed();
    } catch (err) {
      console.error(err);
      showFeed(); // fail open on network hiccups rather than locking someone out
    }
  } else {
    showLogin();
  }
}

function showLogin(message) {
  loginScreen.style.display = "flex";
  feedScreen.style.display = "none";
  if (message) {
    loginError.textContent = message;
    loginError.classList.add("show");
  }
}

function showFeed() {
  loginScreen.style.display = "none";
  feedScreen.style.display = "block";
  userNameChip.textContent = currentUser.name;
  loadFeed();
}

// ---------- Login ----------

loginBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  loginError.classList.remove("show");

  if (!name || !phone) {
    loginError.textContent = "Please enter both your name and phone number.";
    loginError.classList.add("show");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Joining…";
  try {
    currentUser = await loginOrRegister(name, phone);
    showFeed();
  } catch (err) {
    console.error(err);
    if (err.code === "DEACTIVATED") {
      loginError.textContent = "This account has been deactivated by an admin. Contact the group admin if you think this is a mistake.";
    } else {
      loginError.textContent = "Something went wrong. Please check your connection and try again.";
    }
    loginError.classList.add("show");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Join the conversation";
  }
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  currentUser = null;
  nameInput.value = "";
  phoneInput.value = "";
  showLogin();
});

// ---------- Composer: text ----------

postText.addEventListener("input", updatePostBtnState);

function updatePostBtnState() {
  postBtn.disabled = !postText.value.trim() && !recordedBlob && !selectedImageFile;
}

// ---------- Composer: photo / poster ----------

photoBtn.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;

  // Only one attachment type at a time — a photo replaces any recording
  recordedBlob = null;
  audioPreviewWrap.innerHTML = "";

  selectedImageFile = file;
  const url = URL.createObjectURL(file);
  imagePreviewWrap.innerHTML = `
    <div class="image-preview">
      <img src="${url}" alt="Selected photo">
      <button class="discard-btn" id="discardImageBtn">Discard</button>
    </div>
  `;
  document.getElementById("discardImageBtn").addEventListener("click", () => {
    selectedImageFile = null;
    photoInput.value = "";
    imagePreviewWrap.innerHTML = "";
    updatePostBtnState();
  });
  updatePostBtnState();
});

// ---------- Composer: audio recording ----------

micBtn.addEventListener("click", async () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    // Only one attachment type at a time — recording replaces any photo
    selectedImageFile = null;
    photoInput.value = "";
    imagePreviewWrap.innerHTML = "";

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      recordedSeconds = (Date.now() - recordStartTime) / 1000;
      recordedBlob = new Blob(recordedChunks, { type: "audio/webm" });
      stream.getTracks().forEach((t) => t.stop());
      showAudioPreview();
      micBtn.classList.remove("recording");
      micBtnLabel.textContent = "Record a voice note";
      updatePostBtnState();
    };

    recordStartTime = Date.now();
    mediaRecorder.start();
    micBtn.classList.add("recording");
    micBtnLabel.textContent = "Tap to stop";
  } catch (err) {
    console.error(err);
    alert("We couldn't access your microphone. Please allow microphone access and try again.");
  }
});

function showAudioPreview() {
  const url = URL.createObjectURL(recordedBlob);
  audioPreviewWrap.innerHTML = `
    <div class="audio-preview">
      <audio controls src="${url}"></audio>
      <button class="discard-btn" id="discardAudioBtn">Discard</button>
    </div>
  `;
  document.getElementById("discardAudioBtn").addEventListener("click", () => {
    recordedBlob = null;
    audioPreviewWrap.innerHTML = "";
    updatePostBtnState();
  });
}

// ---------- Composer: submit ----------

postBtn.addEventListener("click", async () => {
  postBtn.disabled = true;
  postBtn.textContent = "Sending…";
  try {
    if (recordedBlob) {
      await createAudioPost(currentUser, recordedBlob, recordedSeconds);
    } else if (selectedImageFile) {
      await createImagePost(currentUser, selectedImageFile, postText.value);
    } else {
      await createTextPost(currentUser, postText.value);
    }
    postText.value = "";
    recordedBlob = null;
    audioPreviewWrap.innerHTML = "";
    selectedImageFile = null;
    photoInput.value = "";
    imagePreviewWrap.innerHTML = "";
    await loadFeed();
  } catch (err) {
    console.error(err);
    alert("Your message couldn't be sent. Please try again.");
  } finally {
    postBtn.textContent = "Send";
    updatePostBtnState();
  }
});

// ---------- Feed ----------

async function loadFeed() {
  feedLoading.style.display = "block";
  try {
    const [posts, ad] = await Promise.all([fetchPosts(), fetchActiveAd().catch(() => null)]);
    renderFeed(posts, ad);
  } catch (err) {
    console.error(err);
    feedList.innerHTML = `<div class="empty-state">Couldn't load the group. Pull to refresh or try again shortly.</div>`;
  } finally {
    feedLoading.style.display = "none";
  }
}

function renderFeed(posts, ad) {
  const adHtml = ad
    ? `
      <div class="chat-row ad-row">
        <div class="bubble ad-bubble">
          <div class="bubble-label">Sponsored</div>
          <div class="bubble-body">${escapeHtml(ad.text)}</div>
        </div>
      </div>
    `
    : "";

  if (!posts.length) {
    feedList.innerHTML = adHtml + `<div class="empty-state">No messages yet. Be the first voice in the group.</div>`;
    return;
  }

  // Oldest first, like a real chat thread
  const ordered = [...posts].reverse();

  feedList.innerHTML = adHtml + ordered.map((post) => {
    const isOwn = currentUser && post.user_id === currentUser.id;
    const initial = post.user_name.trim().charAt(0).toUpperCase();

    const body = post.type === "text"
      ? `<div class="bubble-body">${escapeHtml(post.content)}</div>`
      : post.type === "audio"
      ? `<audio class="bubble-audio" controls src="${post.audio_url}"></audio>`
      : `
        <img class="bubble-image" src="${post.image_url}" alt="Photo shared by ${escapeHtml(post.user_name)}">
        ${post.content ? `<div class="bubble-body">${escapeHtml(post.content)}</div>` : ""}
      `;

    return `
      <div class="chat-row ${isOwn ? "own" : ""}" data-id="${post.id}">
        ${isOwn ? "" : `<div class="avatar avatar-sm">${initial}</div>`}
        <div class="bubble ${isOwn ? "bubble-own" : "bubble-other"}">
          ${isOwn ? "" : `<div class="bubble-name">${escapeHtml(post.user_name)}</div>`}
          ${body}
          <div class="bubble-meta">
            ${timeAgo(post.created_at)}
            ${isOwn ? `<button class="bubble-delete" onclick="handleDelete('${post.id}')">Delete</button>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");

  feedList.scrollTop = feedList.scrollHeight;
}

async function handleDelete(postId) {
  if (!confirm("Delete this post?")) return;
  try {
    await deletePost(postId);
    await loadFeed();
  } catch (err) {
    console.error(err);
    alert("Couldn't delete this post. Please try again.");
  }
}

boot();
