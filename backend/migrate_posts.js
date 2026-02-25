// A one-time script to update old posts
require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require('mongoose');
const Post = require('./models/Post'); // The path to your Post model
// IMPORTANT: Replace this placeholder URI with your actual MongoDB connection string
const dbUri = process.env.MONGODB_URI;

async function migrateData() {
  try {
    // FIX: Removed deprecated options (useNewUrlParser, useUnifiedTopology)
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB for migration.');

    // Update all posts of type 'event' that don't have a status field yet
    const eventResult = await Post.updateMany(
      { type: 'event', status: { $exists: false } },
      { $set: { status: 'approved' } }
    );
    // FIX: Changed 'nModified' to 'modifiedCount'
    console.log(`Migration complete. Updated ${eventResult.modifiedCount} event posts.`);
    
    // Update all posts of type 'confession' or 'news' that don't have a status field yet
    const nonEventResult = await Post.updateMany(
      { type: { $ne: 'event' }, status: { $exists: false } },
      { $set: { status: 'approved' } }
    );
    // FIX: Changed 'nModified' to 'modifiedCount'
    console.log(`Migration complete. Updated ${nonEventResult.modifiedCount} non-event posts.`);

    // Update all existing posts to have a default 'source' field if it's an event and the field is missing
    const sourceResult = await Post.updateMany(
        { type: 'event', source: { $exists: false } },
        { $set: { source: 'Confique' } }
    );
    // FIX: Changed 'nModified' to 'modifiedCount'
    console.log(`Migration complete. Updated ${sourceResult.modifiedCount} event posts with a default source.`);
    

    // Update all existing event posts to have an empty 'registrations' array if the field is missing
    const registrationResult = await Post.updateMany(
      { type: 'event', registrations: { $exists: false } },
      { $set: { registrations: [] } }
    );
    // FIX: Changed 'nModified' to 'modifiedCount'
    console.log(`Migration complete. Updated ${registrationResult.modifiedCount} event posts with an empty registrations array.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

migrateData();