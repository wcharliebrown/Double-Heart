console.log("✅ Zillow Double Heart: content script loaded");

// Track state
let currentPropertyId = null;
let currentHeartData = { hearted: false, notes: "", black_heart: false };
let authToken = null;

// Entry point
(async function init() {
  if (!location.hostname.includes("zillow.com")) return;

  // Check for stored token
  await checkAuth();

  // Initial load
  loadForCurrentPage();

  // 🔁 Auto-sync: check every second for property change
  setInterval(loadForCurrentPage, 1000);
})();

// ✅ Main loader for the current page
async function loadForCurrentPage() {
  const propertyId = getZillowPropertyId();

  // Not on a property page => remove heart if it exists
  if (!propertyId) {
    if (currentPropertyId !== null) {
      console.log("ℹ️ Not a property details page anymore, removing heart.");
      currentPropertyId = null;
      currentHeartData = { hearted: false, notes: "", black_heart: false };
      removeHeartIcon();
    }
    return;
  }

  // If property changed, fetch fresh data
  if (propertyId !== currentPropertyId) {
    console.log("🔄 Detected new property:", propertyId);
    currentPropertyId = propertyId;

    const heartState = await fetchHeartStatus(propertyId);
    // Normalize data
    currentHeartData = {
      hearted: !!heartState.hearted,
      notes: heartState.notes || "",
      black_heart: !!heartState.black_heart
    };

    injectHeartIcon(propertyId, currentHeartData);
  }
}

// ✅ Extract Zillow Property ID (zpid) from URL
function getZillowPropertyId() {
  // Example URL:
  // https://www.zillow.com/homedetails/8930-Willingham-Bay-San-Antonio-TX-78254/333535201_zpid/
  const match = location.pathname.match(/(\d+)_zpid/);
  if (match) {
    return match[1];
  }
  return null;
}

// ✅ Authentication functions - Storage helpers with localStorage fallback
async function getStoredToken() {
  try {
    // Try chrome.storage first
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(['authToken']);
      if (result && result.authToken) {
        return result.authToken;
      }
    }
  } catch (e) {
    console.warn("⚠️ Error reading from chrome.storage:", e);
  }
  
  // Fallback to localStorage
  try {
    const token = localStorage.getItem('doubleHeartAuthToken');
    if (token) {
      return token;
    }
  } catch (e) {
    console.warn("⚠️ Error reading from localStorage:", e);
  }
  
  return null;
}

async function saveToken(token) {
  // Try chrome.storage first
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ authToken: token });
      console.log("✅ Token saved to chrome.storage");
      return true;
    }
  } catch (e) {
    console.warn("⚠️ Error saving to chrome.storage:", e);
  }
  
  // Fallback to localStorage
  try {
    localStorage.setItem('doubleHeartAuthToken', token);
    console.log("✅ Token saved to localStorage (fallback)");
    return true;
  } catch (e) {
    console.error("❌ Error saving to localStorage:", e);
    return false;
  }
}

async function removeToken() {
  // Remove from chrome.storage
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(['authToken']);
    }
  } catch (e) {
    // Ignore errors
  }
  
  // Remove from localStorage
  try {
    localStorage.removeItem('doubleHeartAuthToken');
  } catch (e) {
    // Ignore errors
  }
}

async function checkAuth() {
  try {
    const token = await getStoredToken();
    
    if (token) {
      authToken = token;
      console.log("✅ Authentication token found and loaded");
      return true;
    } else {
      console.log("⚠️ No authentication token found, showing login form");
      showLoginForm();
      return false;
    }
  } catch (e) {
    console.error("❌ Error checking auth:", e);
    showLoginForm();
    return false;
  }
}

async function authenticate(username, password) {
  let res;
  try {
    res = await fetch("https://doubleheart.sidebar.org/api/api-authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
  } catch (fetchError) {
    console.error("❌ Fetch error (network/CORS issue):", fetchError);
    return false;
  }

  try {
    // Check if response is ok
    if (!res.ok) {
      let errorText = 'Unknown error';
      try {
        errorText = await res.text();
      } catch (e) {
        // Response body can't be read
      }
      throw new Error(`Authentication failed: ${res.status} - ${errorText}`);
    }

    // Get response text first to handle potential issues
    let responseText;
    try {
      responseText = await res.text();
    } catch (readError) {
      console.error("❌ Error reading response body:", readError);
      throw new Error("Could not read response from server");
    }
    
    if (!responseText) {
      throw new Error("Empty response from server");
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse response as JSON. Response was:", responseText);
      throw new Error("Invalid JSON response from server");
    }

    // Check for success and token in response
    if (data.success && data.token) {
      authToken = data.token;
      await saveToken(data.token);
      console.log("✅ Authentication successful");
      return true;
    } else if (data.token) {
      // Fallback: if token exists but success field is missing, still accept it
      authToken = data.token;
      await saveToken(data.token);
      console.log("✅ Authentication successful (token found)");
      return true;
    } else {
      console.error("❌ No token in response. Response data:", data);
      throw new Error("No token in response");
    }
  } catch (e) {
    console.error("❌ Authentication error:", e);
    return false;
  }
}

function showLoginForm() {
  // Don't show login form if we already have a token
  if (authToken) {
    console.log("ℹ️ Already authenticated, skipping login form");
    return;
  }

  // Remove any existing modal
  const existingModal = document.getElementById("double-heart-login-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "double-heart-login-modal";

  modal.innerHTML = `
    <div style="background:#fff;padding:30px;width:350px;border-radius:10px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <h3 style="margin-top:0;">🔐 Login Required</h3>
      <p style="color:#666;font-size:14px;margin-bottom:20px;">Please login to use Double Heart</p>
      
      <div style="margin-bottom:15px;">
        <label style="display:block;margin-bottom:5px;font-weight:500;">Username:</label>
        <input type="text" id="login-username" 
          style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;"
          placeholder="Enter username">
      </div>
      
      <div style="margin-bottom:20px;">
        <label style="display:block;margin-bottom:5px;font-weight:500;">Password:</label>
        <input type="password" id="login-password" 
          style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;"
          placeholder="Enter password">
      </div>
      
      <div id="login-error" style="color:#d32f2f;font-size:12px;margin-bottom:15px;display:none;"></div>
      
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="login-submit" style="padding:8px 16px;background:#007bff;color:#fff;border:none;border-radius:4px;cursor:pointer;">Login</button>
      </div>
    </div>
  `;

  Object.assign(modal.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,.5)",
    display: "grid",
    placeItems: "center",
    zIndex: "999999"
  });

  document.body.appendChild(modal);

  const usernameInput = modal.querySelector("#login-username");
  const passwordInput = modal.querySelector("#login-password");
  const errorDiv = modal.querySelector("#login-error");
  const submitBtn = modal.querySelector("#login-submit");

  // Focus on username field
  usernameInput.focus();

  // Handle Enter key
  const handleEnter = (e) => {
    if (e.key === "Enter") {
      submitBtn.click();
    }
  };
  usernameInput.addEventListener("keypress", handleEnter);
  passwordInput.addEventListener("keypress", handleEnter);

  submitBtn.onclick = async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      errorDiv.textContent = "Please enter both username and password";
      errorDiv.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";
    errorDiv.style.display = "none";

    const success = await authenticate(username, password);
    
    if (success) {
      modal.remove();
      // Reload current page data after successful login
      loadForCurrentPage();
    } else {
      errorDiv.textContent = "Login failed. Please check your credentials.";
      errorDiv.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  };
}

// ✅ Fetch from your API
async function fetchHeartStatus(propertyId) {
  if (!authToken) {
    console.warn("⚠️ No auth token, cannot fetch heart status");
    return { hearted: false, notes: "", black_heart: false };
  }

  try {
    const res = await fetch(
      `https://doubleheart.sidebar.org/api/api-Get-Double-Hearts?propertyId=${propertyId}`,
      {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      }
    );

    if (!res.ok) {
      if (res.status === 401) {
        // Token expired or invalid
        console.warn("⚠️ Authentication failed, clearing token");
        authToken = null;
        await removeToken();
        showLoginForm();
      }
      console.warn("⚠️ Heart fetch not ok:", res.status);
      return { hearted: false, notes: "", black_heart: false };
    }

    const data = await res.json();
    return data || { hearted: false, notes: "", black_heart: false };
  } catch (e) {
    console.error("❌ Error fetching heart status:", e);
    return { hearted: false, notes: "", black_heart: false };
  }
}

// ✅ Create or update heart icon
function injectHeartIcon(propertyId, data) {
  let heart = document.getElementById("double-heart-icon");

  if (!heart) {
    heart = document.createElement("div");
    heart.id = "double-heart-icon";

    Object.assign(heart.style, {
      position: "fixed",
      top: "18px",
      right: "18px",
      zIndex: "999999",
      fontSize: "32px",
      cursor: "pointer"
    });

    document.body.appendChild(heart);
  }

  // Update appearance based on current data
  heart.innerHTML = data.hearted ? (data.black_heart ? "🖤" : "❤️") : "🤍";

  // Always bind a handler that uses *current* data, not stale closure
  heart.onclick = () => openHeartForm(propertyId);
}

// ✅ Remove icon when not on a details page
function removeHeartIcon() {
  const heart = document.getElementById("double-heart-icon");
  if (heart) {
    heart.remove();
  }
}

// ✅ Popup form using global currentHeartData
function openHeartForm(propertyId) {
  // Remove any existing modal
  const existingModal = document.getElementById("double-heart-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "double-heart-modal";

  modal.innerHTML = `
    <div style="background:#fff;padding:20px;width:300px;border-radius:10px;">
      <h3>❤️ Property ${propertyId}</h3>
      <textarea id="double-heart-notes"
        style="width:100%;height:80px;"
      >${currentHeartData.notes || ""}</textarea>

      <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end;">
        <button id="save-heart">Save</button>
        <button id="close-heart">Cancel</button>
      </div>
    </div>
  `;

  Object.assign(modal.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,.5)",
    display: "grid",
    placeItems: "center",
    zIndex: "999999"
  });

  document.body.appendChild(modal);

  modal.querySelector("#close-heart").onclick = () => modal.remove();

  modal.querySelector("#save-heart").onclick = async () => {
    const notes = modal.querySelector("#double-heart-notes").value;
    await saveHeart(propertyId, notes);

    // Update global state and icon (preserve black_heart status)
    currentHeartData = {
      hearted: true,
      notes,
      black_heart: currentHeartData.black_heart
    };

    const heart = document.getElementById("double-heart-icon");
    if (heart) heart.innerHTML = currentHeartData.black_heart ? "🖤" : "❤️";

    modal.remove();
  };
}

// ✅ Save to your API
async function saveHeart(propertyId, notes) {
  if (!authToken) {
    console.warn("⚠️ No auth token, cannot save heart");
    showLoginForm();
    return;
  }

  try {
    const res = await fetch("https://doubleheart.sidebar.org/api/api-Save-Double-Hearts", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        propertyId,
        hearted: true,
        notes,
        url: location.href
      })
    });

    if (res.status === 401) {
      // Token expired or invalid
      console.warn("⚠️ Authentication failed, clearing token");
      authToken = null;
      await removeToken();
      showLoginForm();
      return;
    }

    if (!res.ok) {
      throw new Error(`Save failed: ${res.status}`);
    }

    console.log("✅ Heart saved.");
  } catch (e) {
    console.error("❌ Error saving heart:", e);
  }
}
