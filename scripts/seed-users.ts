/// <reference types="node" />
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qxcatdirkfbqitvkuvbu.supabase.co';
const supabaseServiceKey = process.env.SEED_SCRIPT_SECRET_KEY;

if (!supabaseServiceKey) {
  throw new Error('SEED_SCRIPT_SECRET_KEY is not set in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestUser {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  language: string;
}

const testUsers: TestUser[] = [
  {
    email: 'owner@demo.com',
    password: 'Demo@Owner123!',
    fullName: 'John Owner',
    phone: '+1-555-0001',
    language: 'en',
  },
  {
    email: 'manager@demo.com',
    password: 'Demo@Manager123!',
    fullName: 'Jane Manager',
    phone: '+1-555-0002',
    language: 'en',
  },
  {
    email: 'admin@demo.com',
    password: 'Demo@Admin123!',
    fullName: 'Bob Admin',
    phone: '+1-555-0003',
    language: 'en',
  },
  {
    email: 'member@demo.com',
    password: 'Demo@Member123!',
    fullName: 'Alice Member',
    phone: '+1-555-0004',
    language: 'he',
  },
  {
    email: 'charlie@startup.com',
    password: 'Demo@Startup123!',
    fullName: 'Charlie Owner',
    phone: '+1-555-0005',
    language: 'en',
  },
];

async function seedUsers() {
  console.log('🌱 Starting user seeding...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const user of testUsers) {
    try {
      console.log(`Creating user: ${user.email}`);

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (authError) {
        // User might already exist
        if (authError.message.includes('already registered') || authError.code === 'email_exists') {
          console.log(`  ⚠️  User already exists, skipping...\n`);
          successCount++;
          continue;
        }
        throw authError;
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('No user ID returned from auth creation');
      }

      // Create or update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          full_name: user.fullName,
          email: user.email,
          phone: user.phone,
          language: user.language,
          has_used_trial: false,
        }, { onConflict: 'user_id' });

      if (profileError) {
        throw profileError;
      }

      console.log(`  ✅ User created successfully (ID: ${userId})\n`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ Error creating user ${user.email}:`, error);
      errorCount++;
    }
  }

  console.log('\n📊 Seeding Summary:');
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${errorCount}`);
  console.log(`  📈 Total: ${testUsers.length}\n`);

  if (errorCount === 0) {
    console.log('✨ All users seeded successfully!');
  }
}

// Run the seeder
seedUsers().catch((error) => {
  console.error('Fatal error during seeding:', error);
  process.exit(1);
});
