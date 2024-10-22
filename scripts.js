let map, directionsService, directionsRenderer, geocoder;
let trekkingMode = false;
let trekkingLine, startMarker, endMarker;
let elevationService;
let elevationData = [];
let landmarks = []; // Store landmark data for later use

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 4.8, // Adjusted zoom level to cover the whole country
        center: { lat: 22.5, lng: 78.9629 }, // Central coordinates of India
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        mapTypeControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT, // Moved to top-right
        },
        scaleControl: true, // Added scale control
        scaleControlOptions: {
            position: google.maps.ControlPosition.BOTTOM_RIGHT // Position for scale control
        }
    });
            

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map: map, draggable: true });
    geocoder = new google.maps.Geocoder();
    directionsRenderer.setMap(map);
    elevationService = new google.maps.ElevationService();
    placesService = new google.maps.places.PlacesService(map);
    distanceMatrixService = new google.maps.DistanceMatrixService();

    const startInput = document.getElementById("start");
    const endInput = document.getElementById("end");
    new google.maps.places.Autocomplete(startInput);
    new google.maps.places.Autocomplete(endInput);

    document.getElementById("findRoute").addEventListener("click", () => {
        calculateAndDisplayRoute(startInput.value, endInput.value);
    });

    document.getElementById("cancelRoute").addEventListener("click", resetRoute);
    document.getElementById('longDriveMode').addEventListener('click', toggleLongDriveMode);
    document.getElementById('generateDrive').addEventListener('click', generateLongDrive);


    document.getElementById("reverseLocations").addEventListener("click", () => {
        const temp = startInput.value;
        startInput.value = endInput.value;
        endInput.value = temp;
    });

    document.getElementById("myLocation").addEventListener("click", showMyLocation);
    document.getElementById("trekkingMode").addEventListener("click", toggleTrekkingMode);

    google.maps.event.addListener(directionsRenderer, 'directions_changed', () => {
        const directions = directionsRenderer.getDirections();
        if (directions) {
            displayRouteDetails(directions.routes[0]);
            findNearbyLandmarks(directions.routes[0]);
        }
    });

    makeControlBoxDraggable();
    map.addListener('click', (event) => {
        if (trekkingMode) {
            addTrekkingMarker(event.latLng);
        }
    });
}

function toggleTrekkingMode() {
    trekkingMode = !trekkingMode;
    const trekkingButton = document.getElementById("trekkingMode");

    if (trekkingMode) {
        trekkingButton.classList.add("active");
    } else {
        trekkingButton.classList.remove("active");
        resetTrekkingMode(); // Call reset function to clear everything
    }
}



let trekkingMarkers = []; // Array to store multiple trekking markers

function addTrekkingMarker(location) {
    const marker = new google.maps.Marker({
        position: location,
        map: map,
        title: `Point ${trekkingMarkers.length + 1}`,
        icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        }
    });
    
    trekkingMarkers.push(marker); // Add the marker to the array
    updateTrekkingLine(); // Redraw the trekking line with the updated markers
}

function updateTrekkingLine() {
    if (trekkingLine) trekkingLine.setMap(null); // Remove existing line

    const path = trekkingMarkers.map(marker => marker.getPosition()); // Get positions of all markers

    trekkingLine = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2
    });

    trekkingLine.setMap(map);

    // Convert the path to an array of lat/lng objects for elevation
    const elevationPath = path.map(point => ({ lat: point.lat(), lng: point.lng() }));
    getElevationAlongPath(elevationPath); // Update the elevation based on the new path
}



function drawTrekkingLine(start, end) {
    if (trekkingLine) trekkingLine.setMap(null); // Remove existing line

    trekkingLine = new google.maps.Polyline({
        path: [start, end],
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2
    });

    trekkingLine.setMap(map);
    const path = trekkingLine.getPath();
    const elevationPath = path.getArray().map(point => ({ lat: point.lat(), lng: point.lng() }));
    getElevationAlongPath(elevationPath);
}

function getElevationAlongPath(path) {
    elevationService.getElevationAlongPath({
        path: path,
        samples: 256
    }, (results, status) => {
        if (status === google.maps.ElevationStatus.OK) {
            elevationData = results.map(result => result.elevation);
            displayElevationData(elevationData);
        } else {
            alert("Elevation request failed due to: " + status);
        }
    });
}

function displayElevationData(elevationInfo) {
    const elevationStats = document.getElementById("routeInfo");
    const elevationGain = calculateElevationGain(elevationInfo);
    elevationStats.innerHTML = `
        <div><strong>Elevation Stats:</strong></div>
        <div><strong>Min Elevation:</strong> ${Math.min(...elevationInfo).toFixed(2)} meters</div>
        <div><strong>Max Elevation:</strong> ${Math.max(...elevationInfo).toFixed(2)} meters</div>
        <div><strong>Elevation Gain:</strong> ${elevationGain.toFixed(2)} meters</div>
    `;
    elevationStats.style.visibility = "visible";
    updateElevationChart(elevationInfo);
}

function calculateElevationGain(elevationInfo) {
    let gain = 0;
    for (let i = 1; i < elevationInfo.length; i++) {
        const diff = elevationInfo[i] - elevationInfo[i - 1];
        if (diff > 0) gain += diff; // Only consider positive changes for gain
    }
    return gain;
}

function updateElevationChart(elevationInfo) {
    const ctx = document.getElementById('elevationChart').getContext('2d');
    const chartData = {
        labels: elevationInfo.map((_, index) => index + 1),
        datasets: [{
            label: 'Elevation (meters)',
            data: elevationInfo,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
        }]
    };
    if (ctx.chart) {
        ctx.chart.destroy(); // Destroy previous chart instance
    }
    ctx.chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Elevation (m)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Points'
                    }
                }
            }
        }
    });
}

function calculateAndDisplayRoute(start, end) {
    if (!start || !end) {
        alert("Please enter both starting and ending locations.");
        return;
    }
    geocoder.geocode({ address: start }, (results, status) => {
        if (status === "OK") {
            const startLocation = results[0].geometry.location;
            geocoder.geocode({ address: end }, (results, status) => {
                if (status === "OK") {
                    const endLocation = results[0].geometry.location;
                    directionsService.route({
                        origin: startLocation,
                        destination: endLocation,
                        travelMode: google.maps.TravelMode.WALKING,
                        avoidTolls: true,
                        region: 'US'
                    }, (response, status) => {
                        if (status === "OK") {
                            directionsRenderer.setDirections(response);
                            const directions = directionsRenderer.getDirections();
                            displayRouteDetails(directions.routes[0]);
                            findNearbyLandmarks(directions.routes[0]);
                            document.querySelector('.nearby').style.display = "block"; // Show landmarks
                        } else {
                            alert("Directions request failed due to " + status);
                        }
                    });
                } else {
                    alert("Could not geocode destination: " + status);
                }
            });
        } else {
            alert("Could not geocode starting location: " + status);
        }
    });
}
 

function displayRouteDetails(route) {
    const routeStats = document.getElementById("routeInfo");
    const distance = route.legs[0].distance.text;
    const duration = route.legs[0].duration.text;
    routeStats.innerHTML = `
        <div><strong>Route Details:</strong></div>
        <div><strong>Distance:</strong> ${distance}</div>
        <div><strong>Duration:</strong> ${duration}</div>
    `;
    routeStats.style.visibility = "visible"; // Show route info
}


function findNearbyLandmarks(route) {
    const service = new google.maps.places.PlacesService(map);
    const path = route.overview_path;

    // Limit the number of landmark searches (e.g., 3 searches along the route)
    const numberOfSearches = 3; // Adjust as needed for more or fewer searches
    const segmentLength = Math.floor(path.length / (numberOfSearches + 1)); // +1 to include both ends

    // Check the distance of the route to decide on landmark types
    const distanceInMeters = route.legs[0].distance.value; // Get distance from the route's legs
    let types;
    if (distanceInMeters < 5000) { // Short route
        types = ['restaurant', 'cafe', 'park']; // Different types for short routes
    } else if (distanceInMeters < 20000) { // Medium route
        types = ['restaurant', 'gas_station', 'hotel'];
    } else { // Long route
        types = ['restaurant', 'gas_station', 'hotel', 'atm', 'parking'];
    }

    // Search at evenly spaced points along the path
    const searchedLocations = new Set(); // Use a set to avoid duplicate searches
    for (let i = 1; i <= numberOfSearches; i++) {
        const pointIndex = i * segmentLength;
        const searchLocation = path[pointIndex];

        // Skip if already searched
        const locKey = `${searchLocation.lat()},${searchLocation.lng()}`;
        if (searchedLocations.has(locKey)) continue;
        searchedLocations.add(locKey);

        const request = {
            location: searchLocation,
            radius: '1000', // Search radius (in meters)
            types: types, // Use dynamic types based on distance
        };

        service.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                displayLandmarks(results);
            } else {
                console.error('Places service failed due to ' + status);
            }
        });
    }
}

function displayLandmarks(landmarks) {
    const landmarkList = document.getElementById("landmarkList");
    landmarkList.innerHTML = '';
    landmarks.forEach(landmark => {
        const li = document.createElement("li");
        li.innerText = landmark.name;
        li.onclick = () => {
            map.setCenter(landmark.geometry.location);
            map.setZoom(15);
        };
        landmarkList.appendChild(li);
        new google.maps.Marker({
            position: landmark.geometry.location,
            map: map,
            title: landmark.name,
        });
    });
}

function updateNearbyLandmarks(landmarks) {
    const nearbyContainer = document.querySelector('.nearby');
    const landmarkList = document.getElementById("landmarkList");
    
    landmarkList.innerHTML = ""; // Clear existing landmarks
    landmarks.forEach(landmark => {
        const li = document.createElement("li");
        li.textContent = landmark.name; // Adjust according to your landmark data
        landmarkList.appendChild(li);
    });

    // Adjust visibility based on content
    if (landmarks.length > 0) {
        nearbyContainer.style.maxHeight = "300px"; // Show container with a maximum height
        nearbyContainer.style.opacity = "1"; // Ensure it's visible
    } else {
        nearbyContainer.style.maxHeight = "0"; // Hide container
        nearbyContainer.style.opacity = "0"; // Make it invisible
        nearbyContainer.style.overflowY = "hidden"; // No scrolling when hidden
    }
}


function showMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            map.setCenter(pos);
            new google.maps.Marker({
                position: pos,
                map: map,
                title: "You are here!",
                icon: {
                    url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                }
            });
        }, () => {
            handleLocationError(true);
        });
    } else {
        handleLocationError(false);
    }
}

function resetRoute() {
    directionsRenderer.set('directions', null);
    resetTrekkingMode();
    document.getElementById("routeInfo").style.visibility = "hidden"; // Hide route info
    document.getElementById("landmarkList").innerHTML = ""; // Clear landmarks
    document.querySelector('.nearby').style.display = "none"; // Hide landmarks
}


function resetTrekkingMode() {
    clearMarkers();
    if (trekkingLine) trekkingLine.setMap(null);
    trekkingLine = null;
    elevationData = [];
    
    // Clear the elevation chart
    const ctx = document.getElementById('elevationChart').getContext('2d');
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (ctx.chart) {
        ctx.chart.destroy(); // Destroy previous chart instance
    }

    // Hide route info
    document.getElementById("routeInfo").style.visibility = "hidden";
}


function clearMarkers() {
    if (startMarker) startMarker.setMap(null);
    if (endMarker) endMarker.setMap(null);
    startMarker = null;
    endMarker = null;
}

function makeControlBoxDraggable() {
    const controlBox = document.getElementById('controlBox');
    let isDragging = false;
    let offsetX, offsetY;

    controlBox.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - controlBox.getBoundingClientRect().left;
        offsetY = e.clientY - controlBox.getBoundingClientRect().top;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            controlBox.style.left = `${e.clientX - offsetX}px`;
            controlBox.style.top = `${e.clientY - offsetY}px`;
        }
    });
}

// Function to toggle visibility of control content
document.getElementById("toggleMenu").onclick = function() {
    const controlContent = document.getElementById("controlContent");
    const toggleIcon = document.getElementById("toggleIcon");
    if (controlContent.style.display === "none" || controlContent.style.display === "") {
        controlContent.style.display = "block";
        toggleIcon.textContent = "▲"; // Change icon to up arrow
    } else {
        controlContent.style.display = "none";
        toggleIcon.textContent = "▼"; // Change icon to down arrow
    }
};

function toggleLongDriveMode() {
    const longDriveControls = document.getElementById('longDriveControls');
    if (longDriveControls.style.display === "none") {
        longDriveControls.style.display = "block";
    } else {
        longDriveControls.style.display = "none";
    }
}

function generateLongDrive() {
    const driveDuration = parseFloat(document.getElementById('driveDuration').value) || 2; // Default to 2 hours
    const driveIntentions = document.getElementById('driveIntentions').value || 'scenic view';

    const startLocation = document.getElementById('start').value;
    
    if (!startLocation) {
        alert('Please enter a starting location.');
        return;
    }

    // Use Places API to find landmarks based on the intentions within a certain radius
    const request = {
        location: map.getCenter(),
        radius: '50000', // 50 km radius from the start point
        query: driveIntentions
    };

    placesService.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            const landmarks = results.slice(0, 5); // Limit to 5 landmarks for simplicity
            calculateLongDriveRoute(startLocation, landmarks, driveDuration);
        } else {
            alert('No landmarks found matching your intentions.');
        }
    });
}

function calculateLongDriveRoute(start, landmarks, driveDuration) {
    const waypointList = landmarks.map(place => ({
        location: place.geometry.location,
        stopover: true
    }));

    const routeRequest = {
        origin: start,
        destination: start, // Round trip back to the starting point
        waypoints: waypointList,
        travelMode: 'DRIVING',
        optimizeWaypoints: true
    };

    directionsService.route(routeRequest, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);

            // Calculate total trip time using Distance Matrix API
            const waypointLocations = [start].concat(landmarks.map(l => l.geometry.location));
            distanceMatrixService.getDistanceMatrix({
                origins: [start],
                destinations: waypointLocations,
                travelMode: 'DRIVING',
            }, (response, status) => {
                if (status === 'OK') {
                    const totalDuration = response.rows[0].elements.reduce((sum, elem) => sum + elem.duration.value, 0) / 3600; // Convert to hours
                }
            });
        } else {
            alert('Could not calculate the route.');
        }
    });
}


window.onload = initMap;
