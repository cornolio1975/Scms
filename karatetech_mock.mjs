import http from 'http';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  // Auth Check
  const auth = req.headers['authorization'];
  if (!auth || auth !== 'Bearer kt_sk_test_1234567890') {
    res.writeHead(401);
    res.end(JSON.stringify({ message: "Invalid API credentials" }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/integration/scms/participants') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const payload = JSON.parse(body);
      
      // Simulate behaviors based on participant name
      if (payload.participant_name === 'FORCE_500') {
        res.writeHead(500);
        res.end(JSON.stringify({ message: "Internal Server Error" }));
        return;
      }
      
      if (payload.participant_name === 'FORCE_TIMEOUT') {
        // Just don't respond, let it timeout (Node default is long, but fetch will timeout)
        return;
      }
      
      if (payload.participant_name === 'FORCE_DUPLICATE_ERROR') {
        res.writeHead(409);
        res.end(JSON.stringify({ message: "Participant already exists" }));
        return;
      }
      
      res.writeHead(200);
      res.end(JSON.stringify({ karatetech_participant_id: 'KT-' + payload.scms_member_id.substring(0,8) }));
    });
  } else if (req.method === 'GET' && req.url.startsWith('/api/integration/scms/sync-status')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const memberId = url.searchParams.get('scms_member_id');
    
    // Simulate KT data state based on scms_member_id
    res.writeHead(200);
    if (memberId === 'KT_ONLY_EDIT') {
      res.end(JSON.stringify({ participant_name: "KT Edited Name", date_of_birth: "2000-01-01" }));
    } else if (memberId === 'BOTH_EDIT') {
      res.end(JSON.stringify({ participant_name: "KT Name Conflict" }));
    } else {
       // Match normal payload to avoid conflict
      res.end(JSON.stringify({ participant_name: "KT Member" }));
    }
  } else if (req.method === 'GET' && req.url === '/api/integration/scms/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3001, () => {
  console.log("Mock KarateTech 3.0 API with Test Scenarios running on port 3001");
});
