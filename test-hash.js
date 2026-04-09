const bcrypt = require('bcryptjs');

async function testHash() {
  const hash = '$2b$10$LAXF8IdzNXN9ajSG9WzTseDlY..B.BE/yD8v/ZjdoVXK0TMK6S6Ji';
  
  console.log('Testing hash:', hash);
  console.log('Password to test: Gaje@7616');
  
  const valid = await bcrypt.compare('Gaje@7616', hash);
  console.log('Password matches:', valid);
  
  // Also create a fresh hash to compare format
  const newHash = await bcrypt.hash('Gaje@7616', 10);
  console.log('New hash format:', newHash);
  console.log('Old hash format:', hash);
  console.log('Hashes match format:', newHash.startsWith('$2b$10$'));
}

testHash().catch(console.error);
