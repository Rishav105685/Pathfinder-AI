// dijkstra.js

class Graph {
    constructor() {
        this.adjacencyList = {};
    }

    addVertex(vertex) {
        if (!this.adjacencyList[vertex]) {
            this.adjacencyList[vertex] = [];
        }
    }

    addEdge(vertex1, vertex2, weight) {
        this.adjacencyList[vertex1].push({ node: vertex2, weight });
        this.adjacencyList[vertex2].push({ node: vertex1, weight }); // For undirected graph
    }

    dijkstra(start) {
        const distances = {};
        const previous = {};
        const queue = new PriorityQueue();

        // Initialize distances and queue
        for (const vertex in this.adjacencyList) {
            distances[vertex] = Infinity;
            previous[vertex] = null;
        }
        distances[start] = 0;
        queue.enqueue(start, 0);

        while (!queue.isEmpty()) {
            const smallest = queue.dequeue().value;

            if (distances[smallest] === Infinity) break;

            for (const neighbor of this.adjacencyList[smallest]) {
                const alt = distances[smallest] + neighbor.weight;

                if (alt < distances[neighbor.node]) {
                    distances[neighbor.node] = alt;
                    previous[neighbor.node] = smallest;
                    queue.enqueue(neighbor.node, alt);
                }
            }
        }

        return { distances, previous };
    }

    shortestPath(start, end) {
        const { distances, previous } = this.dijkstra(start);
        const path = [];
        let current = end;

        while (previous[current]) {
            path.push(current);
            current = previous[current];
        }

        return path.concat(start).reverse(); // Return path from start to end
    }
}

class PriorityQueue {
    constructor() {
        this.values = [];
    }

    enqueue(value, priority) {
        this.values.push({ value, priority });
        this.sort();
    }

    dequeue() {
        return this.values.shift(); // Removes the first item from the array
    }

    sort() {
        this.values.sort((a, b) => a.priority - b.priority);
    }

    isEmpty() {
        return this.values.length === 0;
    }
}

// Function to create a graph from trekking markers
function createGraphFromMarkers(markers) {
    const graph = new Graph();

    // Create vertices for each marker
    markers.forEach((marker, index) => {
        const vertex = `${marker.position.lat()},${marker.position.lng()}`;
        graph.addVertex(vertex);

        // Connect this marker to the next one to create edges
        if (index < markers.length - 1) {
            const nextMarker = markers[index + 1];
            const weight = google.maps.geometry.spherical.computeDistanceBetween(
                marker.position, nextMarker.position
            );
            graph.addEdge(vertex, `${nextMarker.position.lat()},${nextMarker.position.lng()}`, weight);
        }
    });

    return graph;
}

// Function to find and display the shortest path using Dijkstra's algorithm
function findShortestPath() {
    if (!startMarker || !endMarker) {
        alert("Both start and end points must be set to find a path.");
        return;
    }

    const markers = [startMarker, endMarker];
    const graph = createGraphFromMarkers(trekkingMarkers); // Use trekkingMarkers array
    const start = `${startMarker.position.lat()},${startMarker.position.lng()}`;
    const end = `${endMarker.position.lat()},${endMarker.position.lng()}`;

    const path = graph.shortestPath(start, end);
    displayShortestPathOnMap(path);
}

// Function to display the shortest path on the map as a polyline
function displayShortestPathOnMap(path) {
    const coordinates = path.map(point => {
        const [lat, lng] = point.split(',').map(Number);
        return { lat, lng };
    });

    const shortestPathLine = new google.maps.Polyline({
        path: coordinates,
        geodesic: true,
        strokeColor: '#0000FF',
        strokeOpacity: 1.0,
        strokeWeight: 2
    });

    shortestPathLine.setMap(map);
}

// Expose findShortestPath function globally
window.findShortestPath = findShortestPath;

//main html changes => <button id="findShortestPathButton">Find Shortest Path</button>

/*scripts.js changes =>
    
    function initMap() {
    // ... existing code ...

    document.getElementById("findRoute").addEventListener("click", () => {
        calculateAndDisplayRoute(startInput.value, endInput.value);
    });

    document.getElementById("findShortestPathButton").addEventListener("click", findShortestPath); // Add this line

    // ... existing code ...
}
*/

//add script tag => <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDfTc5T0evpoUvZrFYM0DETGibUL64zDu4&libraries=geometry,places"></script>

