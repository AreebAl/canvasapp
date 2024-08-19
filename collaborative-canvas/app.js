var express = require('express');
var pg = require('pg');
var WebSocket = require('ws');
var dotenv = require('dotenv');
dotenv.config();
// Create a new Express application
var app = express();
console.log(process.env.DATABASE_URL,"db url")
// Configure the PostgreSQL connection
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware to parse JSON bodies
app.use(express.json());

// Start the HTTP server
var server = app.listen(3001, function() {
  console.log('Server running on port 3001');
});

// Create a new WebSocket server
var wss = new WebSocket.Server({ server });

// Handle WebSocket connections
wss.on('connection', function(ws) {
  console.log('New WebSocket connection established.');

  ws.on('message', async function(message) {
    try {
      var shape = JSON.parse(message);

      // Validate the shape object
      if (!isValidShape(shape)) {
        ws.send(JSON.stringify({ error: 'Invalid shape data' }));
        return;
      }

      // Insert shape into the database
      var query = `
        INSERT INTO shapes (type, x, y, width, height, radius, x1, y1, x2, y2, color)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      var values = [
        shape.type, shape.x, shape.y, shape.width, shape.height,
        shape.radius, shape.x1, shape.y1, shape.x2, shape.y2, shape.color
      ];

      await pool.query(query, values);

      // Broadcast the new shape to all connected clients
      wss.clients.forEach(function(client) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({ error: 'Server error' }));
    }
  });

  ws.on('error', function(error) {
    console.error('WebSocket error:', error);
  });

  ws.on('close', function() {
    console.log('WebSocket connection closed.');
  });
});

// Function to validate shape data
function isValidShape(shape) {
  var type = shape.type;
  var validTypes = ['rect', 'circle', 'line'];
  return validTypes.indexOf(type) !== -1 &&
         typeof shape.x === 'number' &&
         typeof shape.y === 'number' &&
         (type === 'rect' ? (typeof shape.width === 'number' && typeof shape.height === 'number') : true) &&
         (type === 'circle' ? typeof shape.radius === 'number' : true) &&
         (type === 'line' ? (typeof shape.x1 === 'number' && typeof shape.y1 === 'number' && typeof shape.x2 === 'number' && typeof shape.y2 === 'number') : true) &&
         typeof shape.color === 'string';
}

// REST API endpoint to fetch all shapes
app.get('/shapes', async function(req, res) {
  try {
    var result = await pool.query('SELECT * FROM shapes');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching shapes:', error);
    res.status(500).json({ error: 'Failed to fetch shapes' });
  }
});
