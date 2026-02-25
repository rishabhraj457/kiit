const mongoose = require('mongoose');
require('dotenv').config();

async function fixPhoneIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const collections = await mongoose.connection.db.listCollections().toArray();
    const userCollection = collections.find(c => c.name === 'users');
    
    if (userCollection) {
      const indexes = await mongoose.connection.db.collection('users').indexes();
      const phoneIndex = indexes.find(i => i.name === 'phone_1');
      
      if (phoneIndex) {
        await mongoose.connection.db.collection('users').dropIndex('phone_1');
        console.log('Successfully dropped phone index');
      }
    }
  } catch (error) {
    console.error('Error fixing phone index:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixPhoneIndex();
