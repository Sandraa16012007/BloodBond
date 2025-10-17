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
    limit,
    addDoc,
    deleteDoc
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
// 🩸 GLOBAL LOCATION STATE
// ------------------------------------------------------------------------------------------------------

let userLocation = { lat: null, lng: null };

// Blood type compatibility chart - who can donate to whom
const BLOOD_COMPATIBILITY = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],  // Universal donor
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']  // Universal recipient (can only donate to AB+)
};

/**
 * Check if a donor can donate to a recipient
 * @param {string} donorBloodType - The blood type of the donor
 * @param {string} recipientBloodType - The blood type of the recipient
 * @returns {boolean} - True if donor can donate to recipient
 */
function canDonate(donorBloodType, recipientBloodType) {
    if (!donorBloodType || !recipientBloodType) return false;
    return BLOOD_COMPATIBILITY[donorBloodType]?.includes(recipientBloodType) || false;
}

// ------------------------------------------------------------------------------------------------------
// 🩸 LOCATION HANDLING - UNIVERSAL FUNCTION
// ------------------------------------------------------------------------------------------------------

function setupLocationButton() {
    // Find location button (works for both class and ID)
    const getLocationBtn = document.querySelector(".getLocationBtn") || document.getElementById("getLocationBtn");
    
    if (!getLocationBtn) {
        console.log("Location button not found on this page");
        return;
    }

    console.log("Setting up location button");
    
    // Remove any existing event listeners by cloning the button
    const newBtn = getLocationBtn.cloneNode(true);
    getLocationBtn.parentNode.replaceChild(newBtn, getLocationBtn);
    
    newBtn.addEventListener("click", function(e) {
        e.preventDefault();
        console.log("Location button clicked");
        
        if (!navigator.geolocation) {
            alert("❌ Geolocation is not supported by your browser.");
            return;
        }

        // Show loading state
        const originalText = newBtn.textContent;
        newBtn.textContent = "📍 Getting location...";
        newBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation.lat = position.coords.latitude;
                userLocation.lng = position.coords.longitude;
                
                console.log("Location fetched:", userLocation);
                
                const locationInput = document.getElementById("location");
                if (locationInput) {
                    locationInput.value = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
                    locationInput.style.color = "#28a745";
                }
                
                // Reset button
                newBtn.textContent = "✅ Location Set";
                newBtn.style.background = "#28a745";
                
                setTimeout(() => {
                    newBtn.textContent = originalText;
                    newBtn.style.background = "";
                    newBtn.disabled = false;
                }, 2000);
            },
            (error) => {
                console.error("Geolocation error:", error);
                let errorMessage = "Unable to fetch location.";
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Location permission denied. Please enable location access in your browser settings.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Location information unavailable.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Location request timed out.";
                        break;
                }
                
                alert("⚠️ " + errorMessage);
                newBtn.textContent = originalText;
                newBtn.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// ------------------------------------------------------------------------------------------------------
// 🩸 BLOOD REQUEST SUBMISSION (Request Form Page)
// ------------------------------------------------------------------------------------------------------

if (window.location.pathname.includes("request.html")) {
    
    console.log("Request page detected");
    
    // Setup location button immediately
    setupLocationButton();
    
    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            alert("⚠️ You must be logged in to submit a blood request.");
            window.location.href = "login.html";
            return;
        }
        
        console.log("User authenticated:", user.email);
    });

    const requestFormElement = document.getElementById("requestForm");
    
    if (requestFormElement) {
        console.log("Request form found, setting up submission handler");
        
        requestFormElement.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            console.log("Form submitted");

            const currentUser = auth.currentUser;
            if (!currentUser) {
                alert("⚠️ Please log in first.");
                window.location.href = "login.html";
                return;
            }

            // Validate location
            if (!userLocation.lat || !userLocation.lng) {
                alert("⚠️ Please click 'Get My Location' button before submitting.");
                return;
            }

            // Get form values
            const bloodGroup = document.getElementById("bloodGroup").value;
            const urgency = document.getElementById("urgency").value;
            const hospital = document.getElementById("hospital").value.trim();
            const locationText = document.getElementById("location").value.trim();
            const additional = document.getElementById("additional").value.trim();

            // Validate required fields
            if (!bloodGroup || !urgency || !hospital) {
                alert("⚠️ Please fill all required fields.");
                return;
            }

            console.log("Form data:", { bloodGroup, urgency, hospital, locationText });

            // Map urgency to priority
            const urgencyToPriority = {
                'critical': 'high',
                'high': 'high',
                'medium': 'medium',
                'low': 'low'
            };

            const submitButton = document.getElementById("submitBtn");
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = "Submitting...";
            submitButton.style.background = "#999";

            try {
                // Get user's data
                const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                const userData = userDoc.exists() ? userDoc.data() : {};

                console.log("User data fetched:", userData);

                // Create blood request
                const requestData = {
                    bloodGroup: bloodGroup,
                    priority: urgencyToPriority[urgency] || 'medium',
                    urgency: urgency,
                    hospital: hospital,
                    locationText: locationText,
                    coordinates: {
                        lat: userLocation.lat,
                        lng: userLocation.lng
                    },
                    additionalInfo: additional || "",
                    patientName: userData.fullName || "Anonymous",
                    requestedBy: currentUser.uid,
                    requestedByEmail: currentUser.email,
                    requestedByPhone: userData.phone || "",
                    status: "active",
                    createdAt: new Date()
                };

                console.log("Submitting request data:", requestData);

                // Add to Firebase
                const docRef = await addDoc(collection(db, "bloodRequests"), requestData);
                
                console.log("Request submitted successfully with ID:", docRef.id);

                alert("🎉 Blood request submitted successfully!");
                
                // Reset form and location
                requestFormElement.reset();
                userLocation = { lat: null, lng: null };
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);

            } catch (error) {
                console.error("Error submitting request:", error);
                alert("❌ Failed to submit request: " + error.message);
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
                submitButton.style.background = "";
            }
        });

        // Cancel button handler
        const cancelButton = document.getElementById("cancelBtn");
        if (cancelButton) {
            cancelButton.addEventListener("click", function() {
                if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
                    window.location.href = 'dashboard.html';
                }
            });
        }
    }
}

// ------------------------------------------------------------------------------------------------------
// 🩸 SIGNUP FUNCTIONALITY
// ------------------------------------------------------------------------------------------------------

const signupForm = document.getElementById("signupForm");

if (signupForm) {
    console.log("Signup form found");
    
    // Set up the location button for the signup page
    setupLocationButton();

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
            // Validate location
            if (!userLocation.lat || !userLocation.lng) {
                alert("Please click the 'Get My Location' button before signing up.");
                signupButton.classList.remove("loading");
                signupButton.textContent = "Create Account";
                return;
            }
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save user data in Firestore with proper initial values
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
// 🩸 SHOW DONORS PAGE (showDonors.html)
// ------------------------------------------------------------------------------------------------------

if (window.location.pathname.includes("showDonors.html")) {
    console.log("Show Donors page detected");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            alert("⚠️ You must be logged in to view donors.");
            window.location.href = "login.html";
            return;
        }

        // Get request ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const requestId = urlParams.get('id');

        if (!requestId) {
            alert("⚠️ No request ID provided.");
            window.location.href = "dashboard.html";
            return;
        }

        try {
            // Fetch request details
            const requestDoc = await getDoc(doc(db, "bloodRequests", requestId));
            
            if (!requestDoc.exists()) {
                alert("⚠️ Request not found.");
                window.location.href = "dashboard.html";
                return;
            }

            const requestData = requestDoc.data();

            // Check if the logged-in user is the owner of this request
            if (requestData.requestedBy !== user.uid) {
                alert("⚠️ You can only view donors for your own requests.");
                window.location.href = "dashboard.html";
                return;
            }

            // Fetch accepted donors for this request
            const acceptedDonorsQuery = query(
                collection(db, "acceptedDonations"),
                where("requestId", "==", requestId),
                where("status", "==", "accepted")
            );

            const donorsSnapshot = await getDocs(acceptedDonorsQuery);
            const donorsSection = document.getElementById('donorsSection');

            if (!donorsSection) return;

            if (donorsSnapshot.empty) {
                // No donors have accepted yet
                donorsSection.innerHTML = `
                    <h2>Donors Who Accepted Your Request</h2>
                    <div style="padding: 60px 20px; text-align: center; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-top: 20px; margin-bottom: 40px;">
                        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.7;">⏳</div>
                        <h3 style="color: #333; font-size: 20px; margin-bottom: 12px; font-weight: 600;">No Donors Yet</h3>
                        <p style="color: #666; font-size: 15px; margin: 0 0 12px 0; line-height: 1.6;">
                            No donors have accepted your request yet. We've notified compatible donors in your area.
                        </p>
                        <p style="color: #999; font-size: 14px; margin: 0; line-height: 1.6;">
                            Blood Type Needed: <strong>${requestData.bloodGroup}</strong><br>
                            Hospital: <strong>${requestData.hospital}</strong>
                        </p>
                        <a href="dashboard.html" style="display: inline-block; margin-top: 20px; padding: 10px 24px; background: #e63946; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Back to Dashboard</a>
                    </div>
                `;
                return;
            }

            // Build donors HTML
            let donorsHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Donors Who Accepted Your Request</h2>
                    <span style="background: #e8f5e9; color: #2e7d32; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                        ✓ ${donorsSnapshot.size} Donor${donorsSnapshot.size !== 1 ? 's' : ''} Available
                    </span>
                </div>
            `;

            // Fetch donor details for each accepted donation
            const donorPromises = [];
            donorsSnapshot.forEach((docSnap) => {
                const acceptedData = docSnap.data();
                donorPromises.push(
                    getDoc(doc(db, "users", acceptedData.donorId)).then(donorDoc => ({
                        acceptedData,
                        donorData: donorDoc.exists() ? donorDoc.data() : null
                    }))
                );
            });

            const donors = await Promise.all(donorPromises);

            // Calculate distances and build cards
            for (const { acceptedData, donorData } of donors) {
                if (!donorData) continue;

                let distance = null;
                if (donorData.coordinates && requestData.coordinates) {
                    distance = calculateDistance(
                        donorData.coordinates.lat,
                        donorData.coordinates.lng,
                        requestData.coordinates.lat,
                        requestData.coordinates.lng
                    );
                }

                const timeAgo = getTimeAgo(acceptedData.acceptedAt);
                const distanceText = distance !== null ? `${distance.toFixed(1)} km away` : 'Distance not available';

                donorsHTML += `
                    <div class="donor-card">
                        <div class="card-header">
                            <div class="profile">
                                <div class="icon"><i class="fas fa-user"></i></div>
                                <div class="info">
                                    <h3>${donorData.fullName || 'Anonymous Donor'}</h3>
                                    <span class="available">Available</span>
                                </div>
                            </div>
                        </div>

                        <div class="card-body">
                            <div class="details">
                                <div class="detail-item">
                                    <i class="fas fa-tint"></i>
                                    <span>Blood Group: <strong>${donorData.bloodGroup}</strong></span>
                                </div>
                                <div class="detail-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>Location: <strong>${distanceText}</strong></span>
                                </div>
                                <div class="detail-item">
                                    <i class="fas fa-phone"></i>
                                    <span>Contact: <strong>${donorData.phone || 'Not provided'}</strong></span>
                                </div>
                                <div class="detail-item">
                                    <i class="fas fa-envelope"></i>
                                    <span>Email: <strong>${donorData.email || 'Not provided'}</strong></span>
                                </div>
                            </div>

                            <div class="note">
                                Accepted ${timeAgo}. ${donorData.totalDonations ? `This donor has made ${donorData.totalDonations} donation${donorData.totalDonations !== 1 ? 's' : ''} before.` : 'First-time donor.'}
                            </div>
                        </div>

                        <div class="card-footer">
                            <button class="btn contact" onclick="window.location.href='tel:${donorData.phone || ''}'">
                                <i class="fas fa-phone"></i> Contact Donor
                            </button>
                            <button class="btn message" onclick="window.location.href='mailto:${donorData.email || ''}'">
                                <i class="fas fa-envelope"></i> Send Email
                            </button>
                        </div>
                    </div>
                `;
            }

            donorsSection.innerHTML = donorsHTML;

        } catch (error) {
            console.error("Error loading donors:", error);
            alert("❌ Failed to load donors. Please try again.");
            window.location.href = "dashboard.html";
        }
    });
}

// ------------------------------------------------------------------------------------------------------
// 🩸 SHOW REQUEST PAGE (showRequest.html) - UPDATED WITH ACCEPT FUNCTIONALITY
// ------------------------------------------------------------------------------------------------------

if (window.location.pathname.includes("showRequest.html")) {
    console.log("Show Request page detected");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            alert("⚠️ You must be logged in to view this request.");
            window.location.href = "login.html";
            return;
        }

        // Get request ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const requestId = urlParams.get('id');

        if (!requestId) {
            alert("⚠️ No request ID provided.");
            window.location.href = "dashboard.html";
            return;
        }

        try {
            // Fetch request details
            const requestDoc = await getDoc(doc(db, "bloodRequests", requestId));
            
            if (!requestDoc.exists()) {
                alert("⚠️ Request not found.");
                window.location.href = "dashboard.html";
                return;
            }

            const requestData = requestDoc.data();
            
            // Fetch current user data
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const userData = userDoc.data();

            // Calculate distance
            let distance = 0;
            if (userData.coordinates && requestData.coordinates) {
                distance = calculateDistance(
                    userData.coordinates.lat,
                    userData.coordinates.lng,
                    requestData.coordinates.lat,
                    requestData.coordinates.lng
                );
            }

            // Update page content
            const requesterNameEl = document.querySelector('.info h3');
            const timeEl = document.querySelector('.time');
            const priorityEl = document.querySelector('.priority');
            const bloodGroupEl = document.querySelector('.detail-item strong');
            const distanceEl = document.querySelectorAll('.detail-item')[1].querySelector('strong');
            const locationEl = document.querySelectorAll('.detail-item')[2].querySelector('strong');
            const noteEl = document.querySelector('.note');

            if (requesterNameEl) requesterNameEl.textContent = requestData.patientName || "Anonymous Patient";
            if (timeEl) timeEl.textContent = getTimeAgo(requestData.createdAt);
            
            if (priorityEl) {
                const priorityText = (requestData.priority || 'medium').charAt(0).toUpperCase() + (requestData.priority || 'medium').slice(1);
                priorityEl.textContent = `${priorityText} Priority`;
                priorityEl.className = `priority ${requestData.priority || 'medium'}`;
            }
            
            if (bloodGroupEl) bloodGroupEl.textContent = requestData.bloodGroup;
            if (distanceEl) distanceEl.textContent = `${distance.toFixed(1)} km`;
            if (locationEl) {
                locationEl.innerHTML = `${requestData.hospital}<br><small>${requestData.locationText}</small>`;
            }
            if (noteEl) noteEl.textContent = requestData.additionalInfo || "No additional information provided.";

            // Handle Accept button - NOW SAVES TO DATABASE
            const acceptBtn = document.querySelector('.accept');
            if (acceptBtn) {
                acceptBtn.addEventListener('click', async () => {
                    if (confirm('Are you sure you want to accept this blood donation request?')) {
                        acceptBtn.textContent = 'Processing...';
                        acceptBtn.disabled = true;

                        try {
                            // Create an accepted donation record
                            await addDoc(collection(db, "acceptedDonations"), {
                                requestId: requestId,
                                donorId: user.uid,
                                donorEmail: user.email,
                                requestedBy: requestData.requestedBy,
                                bloodGroup: requestData.bloodGroup,
                                status: "accepted",
                                acceptedAt: new Date(),
                                hospital: requestData.hospital
                            });

                            acceptBtn.textContent = '✓ Accepted!';
                            acceptBtn.style.background = '#28a745';
                            
                            // Show contact information
                            alert(`🎉 Thank you for accepting!\n\nPlease contact the requester:\n\nPhone: ${requestData.requestedByPhone || 'Not provided'}\nEmail: ${requestData.requestedByEmail}\n\nHospital: ${requestData.hospital}\n\nThey will be notified of your acceptance.`);
                            
                            setTimeout(() => {
                                window.location.href = 'dashboard.html';
                            }, 2000);

                        } catch (error) {
                            console.error("Error accepting request:", error);
                            alert("❌ Failed to accept request. Please try again.");
                            acceptBtn.textContent = 'Accept Request';
                            acceptBtn.disabled = false;
                        }
                    }
                });
            }

            // Handle Decline button
            const declineBtn = document.querySelector('.decline');
            if (declineBtn) {
                declineBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to decline this request?')) {
                        window.location.href = 'dashboard.html';
                    }
                });
            }

        } catch (error) {
            console.error("Error loading request:", error);
            alert("❌ Failed to load request details.");
            window.location.href = "dashboard.html";
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
                    await loadBloodRequests(userData.bloodGroup, userData.coordinates, user.uid);

                    // Load user's own requests
                    await loadUserRequests(user.uid);

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

    // Function to load user's own blood requests
    async function loadUserRequests(userId) {
        const userRequestsSection = document.getElementById('userRequestsSection');
        if (!userRequestsSection) return;

        try {
            // Query user's requests
            const requestsQuery = query(
                collection(db, "bloodRequests"),
                where("requestedBy", "==", userId),
                where("status", "==", "active")
            );

            const querySnapshot = await getDocs(requestsQuery);
            console.log("User's requests found:", querySnapshot.size);

            if (querySnapshot.empty) {
                userRequestsSection.innerHTML = `
                    <h2>My Blood Requests</h2>
                    <div style="padding: 40px 20px; text-align: center; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-top: 20px;">
                        <p style="color: #666; font-size: 15px; margin: 0;">You haven't submitted any blood requests yet.</p>
                        <a href="request.html" style="display: inline-block; margin-top: 16px; padding: 10px 24px; background: #e63946; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Submit a Request</a>
                    </div>
                `;
                return;
            }

            let requestsHTML = '<h2>My Blood Requests</h2>';

            querySnapshot.forEach((docSnap) => {
                const request = docSnap.data();
                const requestId = docSnap.id;
                const timeAgo = getTimeAgo(request.createdAt);
                const priorityClass = (request.priority || 'medium').toLowerCase();
                const priorityText = (request.priority || 'Medium').charAt(0).toUpperCase() + (request.priority || 'Medium').slice(1).toLowerCase();

                requestsHTML += `
                    <div class="request-card" style="border-left: 4px solid #2196F3;">
                        <div class="request-header">
                            <div class="requester-info">
                                <span class="requester-name">Patient: ${request.patientName || 'Anonymous'}</span>
                                <span class="priority-badge ${priorityClass}">${priorityText} Priority</span>
                            </div>
                        </div>
                        <div class="request-details">
                            <div class="detail-row blood">
                                Blood Group: <span class="blood-type">${request.bloodGroup || 'Not specified'}</span>
                            </div>
                            <div class="detail-row location">
                                ${request.hospital || 'Hospital'} • ${request.locationText || 'Location not specified'}
                            </div>
                            <div class="detail-row time">
                                Submitted ${timeAgo}
                            </div>
                        </div>
                        <div class="request-actions">
                            <button class="btn-accept" onclick="window.showDonors('${requestId}')">Show Donors</button>
                            <button class="btn-decline" onclick="window.cancelRequest('${requestId}')">Cancel Request</button>
                        </div>
                    </div>
                `;
            });

            userRequestsSection.innerHTML = requestsHTML;

        } catch (error) {
            console.error("Error loading user requests:", error);
            userRequestsSection.innerHTML = `
                <h2>My Blood Requests</h2>
                <div style="padding: 40px 20px; text-align: center; background: white; border-radius: 16px;">
                    <p style="color: #e63946;">Error loading your requests. Please refresh the page.</p>
                </div>
            `;
        }
    }

    // Global functions for user request actions
    window.showDonors = function(requestId) {
        // Redirect to showDonors.html with the request ID
        window.location.href = `showDonors.html?id=${requestId}`;
    };

    window.cancelRequest = async function(requestId) {
        if (!confirm('Are you sure you want to cancel this blood request? This action cannot be undone.')) {
            return;
        }

        try {
            // Update request status to cancelled
            await updateDoc(doc(db, "bloodRequests", requestId), {
                status: "cancelled",
                cancelledAt: new Date()
            });

            alert("✅ Request cancelled successfully.");
            
            // Reload the page to refresh the requests
            window.location.reload();

        } catch (error) {
            console.error("Error cancelling request:", error);
            alert("❌ Failed to cancel request. Please try again.");
        }
    };

    // Helper function to get compatible donor types
    function getCompatibleDonorTypes(recipientBloodType) {
        const donorTypes = [];
        for (const [donorType, canDonateTo] of Object.entries(BLOOD_COMPATIBILITY)) {
            if (canDonateTo.includes(recipientBloodType)) {
                donorTypes.push(donorType);
            }
        }
        return donorTypes;
    }

    // Function to load blood requests - ONLY SHOW REQUESTS WITHIN 5KM AND COMPATIBLE BLOOD TYPES
    // EXCLUDE USER'S OWN REQUESTS
    async function loadBloodRequests(userBloodGroup, userCoordinates, currentUserId) {
        const requestsContainer = document.querySelector('#requestsSection');
        if (!requestsContainer) return;

        try {
            // COMPLETELY CLEAR the requests section first
            requestsContainer.innerHTML = '<h2>Blood Requests Nearby</h2>';

            // Query blood requests collection
            const requestsQuery = query(
                collection(db, "bloodRequests"),
                where("status", "==", "active")
            );

            const querySnapshot = await getDocs(requestsQuery);
            console.log("Total active requests found:", querySnapshot.size);

            if (querySnapshot.empty) {
                showEmptyState(requestsContainer, userBloodGroup);
                return;
            }

            // Filter requests within 5km AND compatible blood types AND not user's own requests
            const compatibleRequests = [];
            
            querySnapshot.forEach((docSnap) => {
                const request = docSnap.data();
                const requestId = docSnap.id;

                console.log("Processing request:", requestId, "Blood type:", request.bloodGroup);

                // EXCLUDE USER'S OWN REQUESTS
                if (request.requestedBy === currentUserId) {
                    console.log(`Skipping - This is user's own request`);
                    return;
                }

                // Check blood type compatibility first
                if (!canDonate(userBloodGroup, request.bloodGroup)) {
                    console.log(`Skipping - User (${userBloodGroup}) cannot donate to recipient (${request.bloodGroup})`);
                    return;
                }

                // Calculate distance if coordinates are available
                if (userCoordinates && userCoordinates.lat && userCoordinates.lng && 
                    request.coordinates && request.coordinates.lat && request.coordinates.lng) {
                    
                    const distance = calculateDistance(
                        userCoordinates.lat,
                        userCoordinates.lng,
                        request.coordinates.lat,
                        request.coordinates.lng
                    );

                    console.log(`Request ${requestId} (${request.bloodGroup}) is ${distance.toFixed(2)} km away`);

                    // Only include requests within 5km radius and compatible blood type
                    if (distance <= 5) {
                        compatibleRequests.push({
                            id: requestId,
                            data: request,
                            distance: distance
                        });
                        console.log(`✅ Added request ${requestId} - Compatible and within 5km`);
                    } else {
                        console.log(`❌ Rejected - Too far (${distance.toFixed(2)} km)`);
                    }
                } else {
                    console.log("Missing coordinates for request:", requestId);
                }
            });

            console.log(`Compatible requests (within 5km): ${compatibleRequests.length} out of ${querySnapshot.size} total`);

            // If no compatible requests found
            if (compatibleRequests.length === 0) {
                console.log("No compatible requests found");
                showEmptyState(requestsContainer, userBloodGroup, true);
                return;
            }

            // Sort by distance (closest first), then by time (newest first)
            compatibleRequests.sort((a, b) => {
                // First sort by distance
                if (a.distance !== b.distance) {
                    return a.distance - b.distance;
                }
                // If same distance, sort by time
                const timeA = a.data.createdAt?.toDate ? a.data.createdAt.toDate().getTime() : 0;
                const timeB = b.data.createdAt?.toDate ? b.data.createdAt.toDate().getTime() : 0;
                return timeB - timeA;
            });

            // Build requests HTML
            let requestsHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Compatible Blood Requests Nearby</h2>
                    <span style="background: #e8f5e9; color: #2e7d32; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                        ✓ ${compatibleRequests.length} Compatible Match${compatibleRequests.length !== 1 ? 'es' : ''}
                    </span>
                </div>
            `;

            compatibleRequests.forEach(({ id, data, distance }) => {
                const timeAgo = getTimeAgo(data.createdAt);
                const priorityClass = (data.priority || 'medium').toLowerCase();
                const priorityText = (data.priority || 'Medium').charAt(0).toUpperCase() + (data.priority || 'Medium').slice(1).toLowerCase();

                requestsHTML += `
                    <div class="request-card" style="border-left: 4px solid #4CAF50;">
                        <div class="request-header">
                            <div class="requester-info">
                                <span class="requester-name">${data.patientName || 'Anonymous Patient'}</span>
                                <span class="priority-badge ${priorityClass}">${priorityText} Priority</span>
                            </div>
                        </div>
                        <div class="request-details">
                            <div class="detail-row blood">
                                Blood Group: <span class="blood-type">${data.bloodGroup || 'Not specified'}</span>
                                <span style="background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px; font-weight: 600;">✓ You can donate</span>
                            </div>
                            <div class="detail-row location">
                                ${data.hospital || 'Hospital'} • ${distance.toFixed(1)} km away
                            </div>
                            <div class="detail-row time">
                                ${timeAgo}
                            </div>
                        </div>
                        <div class="request-actions">
                            <a href="showRequest.html?id=${id}" class="btn-accept">Accept Request</a>
                            <button class="btn-decline" data-request-id="${id}">Decline</button>
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
            showEmptyState(requestsContainer, userBloodGroup);
        }
    }

    // Helper function to show empty state
    function showEmptyState(container, bloodGroup, hasIncompatible = false) {
        const compatibleTypes = BLOOD_COMPATIBILITY[bloodGroup] || [];
        const typesText = compatibleTypes.length > 0 ? compatibleTypes.join(', ') : 'compatible blood types';
        
        let message = `There are currently no blood donation requests within 5km that match your blood type (${bloodGroup}).`;
        let submessage = `You can donate to: <strong>${typesText}</strong>`;
        
        if (hasIncompatible) {
            message = `No compatible blood requests found nearby.`;
            submessage = `We found some requests, but they need blood types you cannot donate to. You (${bloodGroup}) can donate to: <strong>${typesText}</strong>`;
        }

        container.innerHTML = `
            <h2>Blood Requests</h2>
            <div style="padding: 60px 20px; text-align: center; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-top: 20px;">
                <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.7;">🩸</div>
                <h3 style="color: #333; font-size: 20px; margin-bottom: 12px; font-weight: 600;">No Compatible Requests Nearby</h3>
                <p style="color: #666; font-size: 15px; margin: 0 0 12px 0; line-height: 1.6;">${message}</p>
                <p style="color: #999; font-size: 14px; margin: 0; line-height: 1.6;">${submessage}</p>
                <p style="color: #999; font-size: 13px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">We'll notify you immediately when someone nearby needs a compatible blood type.</p>
            </div>
        `;
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

    // 📍 Update Location Button
    const updateLocationBtn = document.getElementById("updateLocationBtn");
    if (updateLocationBtn) {
        updateLocationBtn.addEventListener("click", () => {
            if (!currentUserRef) {
                alert("User data not loaded yet. Please wait a moment.");
                return;
            }

            if (!navigator.geolocation) {
                alert("❌ Geolocation is not supported by your browser.");
                return;
            }

            const originalText = updateLocationBtn.textContent;
            updateLocationBtn.textContent = "Fetching...";
            updateLocationBtn.disabled = true;

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const newCoords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    const newLocationText = `${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)}`;

                    try {
                        await updateDoc(currentUserRef, {
                            coordinates: newCoords,
                            locationText: newLocationText
                        });

                        console.log("✅ Location updated successfully:", newCoords);
                        updateLocationBtn.textContent = "✅ Updated!";
                        setTimeout(() => {
                            updateLocationBtn.textContent = originalText;
                            updateLocationBtn.disabled = false;
                        }, 2500);

                    } catch (error) {
                        console.error("Error updating location in Firestore:", error);
                        alert("❌ Failed to save new location.");
                        updateLocationBtn.textContent = originalText;
                        updateLocationBtn.disabled = false;
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    alert("⚠️ Unable to fetch location. Please ensure location services are enabled.");
                    updateLocationBtn.textContent = originalText;
                    updateLocationBtn.disabled = false;
                }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
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

    // 🚪 Logout
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

// ------------------------------------------------------------------------------------------------------
// 🩸 INITIALIZE LOCATION BUTTON ON ALL PAGES
// ------------------------------------------------------------------------------------------------------

// Call setupLocationButton when DOM is ready, for any page that has the button
document.addEventListener('DOMContentLoaded', () => {
    setupLocationButton();
});