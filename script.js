document.addEventListener("DOMContentLoaded", function() {
    const src = document.getElementById("src");
    const dest = document.getElementById("dest");
    const date = document.getElementById("date");
    const priority = document.getElementById("priority");
    const result = document.getElementById("result");
    const apiKey = "740d245dea3860820e4cbcfd1d0e5c5d"; // Replace with your actual API key

    // Show loading indicator while fetching data
    function showLoading() {
        result.innerHTML = "Loading...";
    }

    function hideLoading() {
        result.innerHTML = "";
    }

    document.getElementById("search-btn").addEventListener("click", async function(event) {
        event.preventDefault();

        const source = src.value.trim().toUpperCase();
        const destination = dest.value.trim().toUpperCase();
        const journeyDate = date.value;

       
        if (!source || !destination || !journeyDate) {
            alert("Please fill in all fields.");
            return;
        }

        showLoading();

        try {
            const flights = await fetchFlightData(apiKey, journeyDate);
            if (flights.length === 0) 
                throw new Error("No flights found for the given date.");
            console.log(flights);
            // Filter flights based on source and destination
            const filteredFlights = filterFlights(flights, source, destination);
            console.log("Filtered Flights:", filteredFlights);
            // If no flights match the source and destination
            if (filteredFlights.length === 0) 
                throw new Error("No flights match your source and destination.");

            // Build the graph based on the available flights
            const graph = buildGraph(filteredFlights,flights,priority.value);
            console.log("Graph Built:", graph);

            // Run Dijkstra's algorithm to find the shortest path with max 2 stops
            const { distances, prevNodes } = dijkstra(graph, source, destination);
            console.log("hello",distances);
            // Find the shortest path
            const shortestPath = findShortestPath(distances, prevNodes, destination);
            console.log("Shortest Path:", shortestPath);

            // Display the result (path and cost/time)
            displayResult(shortestPath, distances[destination], priority.value);

        } catch (error) {
            console.error("Error:", error);
            result.innerHTML = error.message;
        } finally {
            hideLoading();
        }
    });

    async function fetchFlightData(apiKey, date) {
        const url = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&date=${date}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Failed to fetch flight data.");
        }

        const data = await response.json();
        return data.data;
    }

    function filterFlights(flights, source, destination) {
        // Filter only flights matching the source and destination directly
        return flights.filter(flight =>
            flight.departure.iata.toUpperCase() === source && flight.arrival.iata.toUpperCase() === destination
        );
    }

    // Function to filter flights based on source airport
    function filterDest(flights, dest) {
        return flights.filter(flight => flight.arrival.iata.toUpperCase() === dest.toUpperCase());
    }
    function filterSrc(flights, src) {
        return flights.filter(flight => flight.departure.iata.toUpperCase() === src.toUpperCase());
    }

    function buildGraph(filteredFlights,flights,priority,) {
        let graph = {};

        // First, add all direct flights
        let from;
        let to;
        filteredFlights.forEach(flight => {
            from = flight.departure.iata;
            to = flight.arrival.iata;
            const weight = flight_time(flight.arrival.scheduled, flight.departure.scheduled); // Time calculation

            if (!graph[from]) {
                graph[from] = [];
            }
            graph[from].push({ node: to, weight: weight });

        });

        const same_dest = filterDest(flights, to); // Get flights departing from this arrival airport
        console.log("1",same_dest);
        const same_src = filterSrc(flights,from);
        console.log("2",same_src);
        same_src.forEach(flight_src =>{
            same_dest.forEach(flight_dest=>{
                console.log("3",flight_src,flight_dest)
                if(flight_src.arrival.iata===flight_dest.departure.iata&&flight_time(flight_dest.departure.scheduled,flight_src.arrival.scheduled)>0)
                {
                    if (!graph[flight_src.departure.iata]) {
                        graph[flight_src.departure.iata] = [];
                    }
                    if (!graph[flight_dest.departure.iata]) {
                        graph[flight_dest.departure.iata] = [];
                    }
                    graph[flight_src.departure.iata].push({node:flight_src.arrival.iata,weight:flight_time(flight_src.arrival.scheduled,flight_src.departure.scheduled)});
                    graph[flight_dest.departure.iata].push({node:flight_dest.arrival.iata,weight:flight_time(flight_dest.arrival.scheduled,flight_dest.departure.scheduled)});
                }
            })            
        });

        // Add multi-leg flights (where the arrival of one flight is the departure of another)
        
        return graph;
    }

    function flight_time(time1, time2) {
        const date1 = new Date(time1);
        const date2 = new Date(time2);
        const timeDifferenceMs = date1 - date2;
        const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);
        return timeDifferenceMinutes;
    }

    function dijkstra(graph, source, destination) {
        const distances = {};
        const prevNodes = {};
        const pq = new PriorityQueue();
    
        // Initialize distances and prevNodes
        for (let node in graph) {
            distances[node] = Infinity;
            prevNodes[node] = null;
        }
    
        distances[source] = 0;
        pq.enqueue(source, 0);
    
        while (!pq.isEmpty()) {
            const { node } = pq.dequeue();
            if (node === destination) break; 
            if (!graph[node]) 
                continue;
    
            graph[node].forEach(neighbor => {
                const { node: nextNode, weight } = neighbor;
                const alt = distances[node] + neighbor.weight;
    
                // Only allow paths with a maximum of 2 stops (3 airports)
    
                if (alt < distances[nextNode]) {
                    distances[nextNode] = alt;
                    prevNodes[nextNode] = node;
                    pq.enqueue(nextNode, distances[nextNode]);
                }
            });
        }
    
        console.log("Distances:", distances); // Log all distances to debug
        return { distances, prevNodes };
    }
    
    function findShortestPath(distances, prevNodes, destination) {
        const path = [];
        let currentNode = destination;
    
        // Trace back the path from the destination
        while (currentNode) {
            path.unshift(currentNode);
            currentNode = prevNodes[currentNode];
        }
    
        console.log("Path:", path); // Log the path to debug
        console.log("Shortest Distance:", distances[destination]); // Log the distance to debug
    
        return path;
    }
    

    function displayResult(path, distance, priority) {
        const pathElement = document.createElement("div");
        pathElement.classList.add("path-result");
    
        pathElement.innerHTML = `
            <h2>Optimal Path (${priority})</h2>
            <p><strong>Path:</strong> ${path.join(" -> ")}</p>
            <p><strong>Total ${priority}:</strong> ${distance}</p>
        `;
    
        result.innerHTML = "";  // Clear previous results
        result.appendChild(pathElement);
    }
    

    class PriorityQueue {
        constructor() {
            this.queue = [];
        }

        enqueue(node, priority) {
            this.queue.push({ node, priority });
            this.queue.sort((a, b) => a.priority - b.priority);
        }

        dequeue() {
            return this.queue.shift();
        }

        isEmpty() {
            return this.queue.length === 0;
        }
    }
});
