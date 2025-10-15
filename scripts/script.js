// ------------------------------------------------------------------------------------------------------
// ✅ FIREBASE CONFIGURATION
// ------------------------------------------------------------------------------------------------------

const firebaseConfig = {
    apiKey: "AIzaSyCqPtJkohJfCTVBhWt7vcrAeauiAXaXAt8",
    authDomain: "bloodbond-ee8a5.firebaseapp.com",
    projectId: "bloodbond-ee8a5",
    storageBucket: "bloodbond-ee8a5.firebasestorage.app",
    messagingSenderId: "899623338365",
    appId: "1:899623338365:web:8d84ad2d8b8e03e5fa4c14"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// For later: Firebase Cloud Messaging (optional)
import {
    getMessaging,
    getToken
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ------------------------------------------------------------------------------------------------------
// 🩸 LOCATION HANDLING
// ------------------------------------------------------------------------------------------------------

let userLocation = { lat: null, lng: null };

const getLocationBtn = document.getElementById("getLocationBtn");
if (getLocationBtn) {
    getLocationBtn.addEventListener("click", () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation.lat = position.coords.latitude;
                    userLocation.lng = position.coords.longitude;
                    const locationInput = document.getElementById("location");
                    locationInput.value = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
                },
                (error) => {
                    alert("⚠️ Unable to fetch location. Please allow location access.");
                    console.error("Geolocation error:", error);
                }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    });
}

// ------------------------------------------------------------------------------------------------------
// 🩸 SIGNUP FUNCTIONALITY
// ------------------------------------------------------------------------------------------------------

const signupForm = document.getElementById("signupForm");

if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const bloodGroup = document.getElementById("bloodGroup").value;
        const gender = document.getElementById("gender").value;
        const locationText = document.getElementById("location").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const isAvailable = document.querySelector(".switch input").checked;
        const signupButton = document.getElementById("signupButton");

        signupButton.classList.add("loading");
        signupButton.textContent = "";
        const spinner = document.createElement("div");
        spinner.classList.add("spinner");
        signupButton.appendChild(spinner);

        try {
            // 🔐 Create user in Firebase Auth
            if (!userLocation.lat || !userLocation.lng) {
                alert("Please click the 'Get Location' button before signing up.");
                signupButton.classList.remove("loading");
                signupButton.textContent = "Create Account";
                return;
            }
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 🧾 Save user data in Firestore with proper initial values
            await setDoc(doc(db, "users", user.uid), {
                fullName,
                email,
                bloodGroup,
                gender,
                phone,
                isAvailable,
                locationText,
                coordinates: userLocation,
                notificationsEnabled: false,
                notificationToken: null,
                totalDonations: 0,
                livesSaved: 0,
                lastDonation: null,
                nextEligible: null,
                createdAt: new Date()
            });

            alert("🎉 Account created successfully!");
            signupButton.classList.remove("loading");
            signupButton.textContent = "Create Account";
            signupForm.reset();
            window.location.href = "login.html";

        } catch (error) {
            console.error("Signup Error:", error.message);
            alert("Signup failed: " + error.message);
            signupButton.classList.remove("loading");
            signupButton.textContent = "Create Account";
        }
    });
}

// ------------------------------------------------------------------------------------------------------
// 🩸 LOGIN FUNCTIONALITY
// ------------------------------------------------------------------------------------------------------

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const loginButton = document.getElementById("loginButton");

        loginButton.classList.add("loading");
        loginButton.textContent = "";
        const spinner = document.createElement("div");
        spinner.classList.add("spinner");
        loginButton.appendChild(spinner);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log("Login successful:", user.email);
            loginButton.classList.remove("loading");
            loginButton.textContent = "✓ Success!";
            loginButton.style.background = "#4CAF50";

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1000);

        } catch (error) {
            console.error("Login error:", error.message);
            alert("Login failed: " + error.message);
            loginButton.classList.remove("loading");
            loginButton.textContent = "Login";
        }
    });
}

// ------------------------------------------------------------------------------------------------------
// 🩸 DASHBOARD HANDLING (Dynamic Data + Notifications)
// ------------------------------------------------------------------------------------------------------

if (window.location.pathname.includes("dashboard.html")) {

    // IMMEDIATELY disable the hardcoded animation script
    window.dashboardDataLoaded = false;

    const userNameEl = document.querySelector(".welcome-section h1");
    const bloodGroupEl = document.querySelector(".stat-card:nth-child(1) .stat-value");
    const donationsEl = document.querySelector(".stat-card:nth-child(2) .stat-value");
    const livesSavedEl = document.querySelector(".stat-card:nth-child(3) .stat-value");
    const statusToggle = document.getElementById("statusToggle");
    const enableNotificationsToggle = document.getElementById("enableNotificationsToggle");
    const logoutBtn = document.querySelector(".btn-logout");
    const requestsSection = document.getElementById("requestsSection");
    const activeCard = document.getElementById("activeCard");
    const inactiveCard = document.getElementById("inactiveCard");
    const statusBadge = document.getElementById("statusBadge");

    let currentUserRef = null;
    let currentUserId = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserRef = doc(db, "users", user.uid);
            currentUserId = user.uid;

            try {
                const userSnap = await getDoc(currentUserRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();

                    // 🔧 MIGRATION: Add missing fields for existing users
                    const missingFields = {};
                    if (userData.totalDonations === undefined) missingFields.totalDonations = 0;
                    if (userData.livesSaved === undefined) missingFields.livesSaved = 0;
                    if (userData.lastDonation === undefined) missingFields.lastDonation = null;
                    if (userData.nextEligible === undefined) missingFields.nextEligible = null;
                    if (userData.notificationsEnabled === undefined) missingFields.notificationsEnabled = false;
                    if (userData.notificationToken === undefined) missingFields.notificationToken = null;

                    // Update document if any fields are missing
                    if (Object.keys(missingFields).length > 0) {
                        console.log("Adding missing fields:", missingFields);
                        await updateDoc(currentUserRef, missingFields);
                        // Merge with userData
                        Object.assign(userData, missingFields);
                    }

                    // 🌟 UPDATE ALL DASHBOARD ELEMENTS WITH FIREBASE DATA
                    console.log("Loading dashboard data:", userData);

                    // Update welcome message
                    if (userNameEl) {
                        userNameEl.textContent = `Welcome back, ${userData.fullName || "User"}!`;
                    }

                    // Update blood group
                    if (bloodGroupEl) {
                        bloodGroupEl.textContent = userData.bloodGroup || "--";
                    }

                    // Update stats - FORCE UPDATE, NO ANIMATION
                    if (donationsEl) {
                        donationsEl.textContent = String(userData.totalDonations || 0);
                        donationsEl.setAttribute('data-firebase-loaded', 'true');
                    }

                    if (livesSavedEl) {
                        livesSavedEl.textContent = String(userData.livesSaved || 0);
                        livesSavedEl.setAttribute('data-firebase-loaded', 'true');
                    }

                    // Update donation history
                    const lastDonationEl = document.querySelector(".history-row:nth-child(1) .history-value");
                    const nextEligibleEl = document.querySelector(".history-row:nth-child(2) .history-value");

                    if (lastDonationEl) {
                        if (userData.lastDonation) {
                            const lastDonationDate = userData.lastDonation.toDate ? userData.lastDonation.toDate() : new Date(userData.lastDonation);
                            lastDonationEl.textContent = lastDonationDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                        } else {
                            lastDonationEl.textContent = "No donations yet";
                        }
                    }

                    if (nextEligibleEl) {
                        if (userData.nextEligible) {
                            const nextEligibleDate = userData.nextEligible.toDate ? userData.nextEligible.toDate() : new Date(userData.nextEligible);
                            nextEligibleEl.textContent = nextEligibleDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                        } else {
                            nextEligibleEl.textContent = "Available now";
                        }
                    }

                    // Set toggles based on user data
                    if (statusToggle) {
                        statusToggle.checked = userData.isAvailable ?? true;
                    }

                    if (enableNotificationsToggle) {
                        enableNotificationsToggle.checked = userData.notificationsEnabled ?? false;
                    }

                    // Update UI based on availability status
                    updateAvailabilityUI(userData.isAvailable ?? true);

                    // Update active/inactive card text with user's blood group
                    const activeCardTitle = document.getElementById("activeCardTitle");
                    const activeCardText = document.getElementById("activeCardText");
                    if (activeCardTitle) {
                        activeCardTitle.textContent = "You're Currently Active";
                    }
                    if (activeCardText) {
                        activeCardText.textContent = `Thank you for being available to donate! You'll receive notifications when someone nearby needs ${userData.bloodGroup || "blood"}.`;
                    }

                    // Load blood requests (will replace hardcoded ones)
                    await loadBloodRequests(userData.bloodGroup, userData.coordinates);

                    // Mark dashboard as loaded
                    window.dashboardDataLoaded = true;

                } else {
                    console.error("User document does not exist");
                    window.location.href = "login.html";
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                alert("Error loading dashboard. Please try again.");
            }
        } else {
            window.location.href = "login.html";
        }
    });

    // Function to update availability UI
    function updateAvailabilityUI(isActive) {
        if (statusBadge) {
            if (isActive) {
                statusBadge.textContent = 'Active';
                statusBadge.classList.remove('inactive');
            } else {
                statusBadge.textContent = 'Inactive';
                statusBadge.classList.add('inactive');
            }
        }

        if (activeCard) {
            activeCard.style.display = isActive ? 'block' : 'none';
        }

        if (inactiveCard) {
            inactiveCard.style.display = isActive ? 'none' : 'block';
        }

        if (requestsSection) {
            requestsSection.style.display = isActive ? 'block' : 'none';
        }
    }

    // Function to load blood requests - REPLACES ALL HARDCODED CONTENT
    async function loadBloodRequests(userBloodGroup, userCoordinates) {
        const requestsContainer = document.querySelector('#requestsSection');
        if (!requestsContainer) return;

        try {
            // COMPLETELY CLEAR the requests section first
            requestsContainer.innerHTML = '<h2>Blood Requests</h2>';

            // Query blood requests collection
            const requestsQuery = query(
                collection(db, "bloodRequests"),
                where("status", "==", "active"),
                orderBy("createdAt", "desc"),
                limit(10)
            );

            const querySnapshot = await getDocs(requestsQuery);

            if (querySnapshot.empty) {
                // No requests found - show styled empty state
                requestsContainer.innerHTML = `
                    <h2>Blood Requests</h2>
                    <div style="padding: 60px 20px; text-align: center; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-top: 20px;">
                        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.7;">🩸</div>
                        <h3 style="color: #333; font-size: 20px; margin-bottom: 12px; font-weight: 600;">No Active Blood Requests</h3>
                        <p style="color: #666; font-size: 15px; margin: 0; line-height: 1.6;">There are currently no blood donation requests in your area.</p>
                        <p style="color: #999; font-size: 14px; margin-top: 8px;">We'll notify you immediately when someone needs ${userBloodGroup || 'your blood type'}.</p>
                    </div>
                `;
                return;
            }

            // Build requests HTML
            let requestsHTML = '<h2>Blood Requests</h2>';

            querySnapshot.forEach((docSnap) => {
                const request = docSnap.data();
                const requestId = docSnap.id;

                // Calculate distance if coordinates are available
                let distance = "Location not specified";
                if (userCoordinates && request.coordinates) {
                    const dist = calculateDistance(
                        userCoordinates.lat,
                        userCoordinates.lng,
                        request.coordinates.lat,
                        request.coordinates.lng
                    );
                    distance = `${dist.toFixed(1)} km away`;
                }

                // Calculate time ago
                const timeAgo = getTimeAgo(request.createdAt);

                // Get priority class
                const priorityClass = (request.priority || 'medium').toLowerCase();
                const priorityText = (request.priority || 'Medium').charAt(0).toUpperCase() + (request.priority || 'Medium').slice(1).toLowerCase();

                requestsHTML += `
                    <div class="request-card">
                        <div class="request-header">
                            <div class="requester-info">
                                <span class="requester-name">${request.patientName || 'Anonymous Patient'}</span>
                                <span class="priority-badge ${priorityClass}">${priorityText} Priority</span>
                            </div>
                        </div>
                        <div class="request-details">
                            <div class="detail-row blood">
                                Blood Group: <span class="blood-type">${request.bloodGroup || 'Not specified'}</span>
                            </div>
                            <div class="detail-row location">
                                ${request.hospital || 'Hospital'} • ${distance}
                            </div>
                            <div class="detail-row time">
                                ${timeAgo}
                            </div>
                        </div>
                        <div class="request-actions">
                            <a href="showRequest.html?id=${requestId}" class="btn-accept">Accept Request</a>
                            <button class="btn-decline" data-request-id="${requestId}">Decline</button>
                        </div>
                    </div>
                `;
            });

            requestsContainer.innerHTML = requestsHTML;

            // Add decline button handlers
            document.querySelectorAll('.btn-decline').forEach(btn => {
                btn.addEventListener('click', function () {
                    this.textContent = 'Declined';
                    this.disabled = true;
                    this.style.opacity = '0.5';
                    this.style.cursor = 'not-allowed';
                });
            });

        } catch (error) {
            console.error("Error loading blood requests:", error);

            // Show empty state on error (likely collection doesn't exist)
            requestsContainer.innerHTML = `
                <h2>Blood Requests</h2>
                <div style="padding: 60px 20px; text-align: center; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-top: 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.7;">🩸</div>
                    <h3 style="color: #333; font-size: 20px; margin-bottom: 12px; font-weight: 600;">No Active Blood Requests</h3>
                    <p style="color: #666; font-size: 15px; margin: 0; line-height: 1.6;">There are currently no blood donation requests in your area.</p>
                    <p style="color: #999; font-size: 14px; margin-top: 8px;">We'll notify you immediately when someone needs ${userBloodGroup || 'your blood type'}.</p>
                </div>
            `;
        }
    }

    // Helper function to calculate distance between two coordinates
    function calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Radius of the Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Helper function to get time ago
    function getTimeAgo(timestamp) {
        if (!timestamp) return 'Just now';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    // 🩸 Update Availability
    if (statusToggle) {
        statusToggle.addEventListener("change", async function () {
            if (currentUserRef) {
                const isChecked = this.checked;
                try {
                    await updateDoc(currentUserRef, { isAvailable: isChecked });
                    console.log("✅ Availability updated:", isChecked);
                    updateAvailabilityUI(isChecked);
                } catch (error) {
                    console.error("Error updating availability:", error);
                    alert("Failed to update availability. Please try again.");
                    // Revert the toggle
                    this.checked = !isChecked;
                }
            }
        });
    }

    // 🔔 Update Notifications Toggle (with permission + token)
    if (enableNotificationsToggle) {
        enableNotificationsToggle.addEventListener("change", async function () {
            if (!currentUserRef) return;

            const isEnabling = this.checked;

            try {
                if (isEnabling) {
                    // Ask for permission
                    const permission = await Notification.requestPermission();

                    if (permission === "granted") {
                        try {
                            const messaging = getMessaging(app);
                            // Replace with your actual VAPID key from Firebase Console
                            const vapidKey = "YOUR_VAPID_KEY_HERE";

                            const token = await getToken(messaging, {
                                vapidKey: vapidKey
                            });

                            console.log("🔔 FCM Token:", token);

                            await updateDoc(currentUserRef, {
                                notificationsEnabled: true,
                                notificationToken: token
                            });

                            alert("✅ Notifications enabled successfully!");
                        } catch (tokenError) {
                            console.error("Error getting FCM token:", tokenError);
                            // Still update the preference even if token fails
                            await updateDoc(currentUserRef, {
                                notificationsEnabled: true,
                                notificationToken: null
                            });
                            alert("✅ Notifications preference saved!");
                        }
                    } else {
                        alert("⚠️ Permission denied. Please enable notifications in your browser settings.");
                        this.checked = false;
                    }
                } else {
                    // Disable notifications
                    await updateDoc(currentUserRef, {
                        notificationsEnabled: false,
                        notificationToken: null
                    });
                    console.log("🔕 Notifications disabled");
                    alert("Notifications disabled successfully.");
                }
            } catch (error) {
                console.error("Error managing notifications:", error);
                alert("Failed to update notification settings. Please try again.");
                // Revert the toggle
                this.checked = !isEnabling;
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                console.log("User logged out successfully");
                window.location.href = "index.html";
            } catch (error) {
                console.error("Logout failed:", error.message);
                alert("Logout failed: " + error.message);
            }
        });
    }
}