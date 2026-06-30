import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { encodeGeohash } from '../utils/geo';
import { Neighborhood, Department, Issue } from '../types';

export async function seedDatabase() {
  try {
    console.log('Ensuring 5 standard departments are seeded...');

    // 1. Seed the 5 departments requested
    const departments: Department[] = [
      {
        id: 'roads',
        name: 'Roads',
        accountabilityScore: 82,
        avgResponseHours: 24,
        resolutionRate: 0.85,
      },
      {
        id: 'water_drainage',
        name: 'Water & Drainage',
        accountabilityScore: 90,
        avgResponseHours: 12,
        resolutionRate: 0.93,
      },
      {
        id: 'electrical_lighting',
        name: 'Electrical/Lighting',
        accountabilityScore: 78,
        avgResponseHours: 18,
        resolutionRate: 0.88,
      },
      {
        id: 'sanitation',
        name: 'Sanitation',
        accountabilityScore: 85,
        avgResponseHours: 8,
        resolutionRate: 0.95,
      },
      {
        id: 'parks_environment',
        name: 'Parks & Environment',
        accountabilityScore: 80,
        avgResponseHours: 36,
        resolutionRate: 0.82,
      },
    ];

    for (const dept of departments) {
      await setDoc(doc(db, 'departments', dept.id), dept);
    }
    console.log('Seeded 5 standard departments.');

    // Check if seeding of neighborhoods and issues has already been done
    const querySnapshot = await getDocs(collection(db, 'neighborhoods'));
    if (!querySnapshot.empty) {
      console.log('Database neighborhoods/issues already seeded. Skipping other collections.');
      return;
    }

    console.log('Starting Firestore database seeding of neighborhoods and issues...');

    // 2. Seed Neighborhoods
    const neighborhoods: Neighborhood[] = [
      {
        id: 'mission_district',
        name: 'The Mission District',
        boundaryCenter: { lat: 37.7599, lng: -122.4148 },
        healthScores: {
          infrastructure: 65,
          cleanliness: 58,
          safety: 72,
          lighting: 60,
          water: 82,
          green: 70,
          accessibility: 64,
          engagement: 88,
        },
        communityXP: 420,
        communityLevel: 3,
      },
      {
        id: 'north_beach',
        name: 'North Beach',
        boundaryCenter: { lat: 37.8014, lng: -122.4087 },
        healthScores: {
          infrastructure: 74,
          cleanliness: 68,
          safety: 78,
          lighting: 72,
          water: 85,
          green: 62,
          accessibility: 68,
          engagement: 81,
        },
        communityXP: 810,
        communityLevel: 5,
      },
    ];

    for (const nb of neighborhoods) {
      await setDoc(doc(db, 'neighborhoods', nb.id), nb);
    }
    console.log('Seeded 2 neighborhoods.');

    // 3. Seed 15 Realistic Issues in San Francisco
    const issuesList: Omit<Issue, 'id'>[] = [
      // Mission District Issues
      {
        reporterId: 'seed_user_1',
        status: 'in_progress',
        type: 'pothole',
        severity: 0.8,
        title: 'Deep pothole on 24th St and Valencia',
        description: 'Large, dangerous pothole right in the middle of the bicycling lane on 24th street. Forcing cyclists into traffic lanes.',
        location: {
          lat: 37.7525,
          lng: -122.4211,
          geohash: encodeGeohash(37.7525, -122.4211),
        },
        neighborhoodId: 'mission_district',
        departmentId: 'roads',
        priority: 'high',
        mediaUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=400',
        reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_2',
        status: 'resolved',
        type: 'broken_streetlight',
        severity: 0.5,
        title: 'Broken streetlight near Dolores Park entrance',
        description: 'Lamp number 402 near the Dolores & 19th street entrance is completely dark. Safety hazard during evening hours.',
        location: {
          lat: 37.7596,
          lng: -122.4269,
          geohash: encodeGeohash(37.7596, -122.4269),
        },
        neighborhoodId: 'mission_district',
        departmentId: 'electrical_lighting',
        priority: 'medium',
        mediaUrl: 'https://images.unsplash.com/photo-1509021436665-8f37bc7065be?auto=format&fit=crop&q=80&w=400',
        reportedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        reporterId: 'seed_user_3',
        status: 'routed',
        type: 'water_leak',
        severity: 0.9,
        title: 'Major water main leak on 16th St',
        description: 'Clean drinking water is bubbling up continuously from the asphalt seam near the Bart Station. Flooding the sidewalk.',
        location: {
          lat: 37.7649,
          lng: -122.4195,
          geohash: encodeGeohash(37.7649, -122.4195),
        },
        neighborhoodId: 'mission_district',
        departmentId: 'water_drainage',
        priority: 'critical',
        mediaUrl: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&q=80&w=400',
        reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12h ago
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_4',
        status: 'pending',
        type: 'waste_problem',
        severity: 0.6,
        title: 'Illegal mattress dumping on Harrison St',
        description: 'Two large queen mattresses and box springs left on the sidewalk, blocking wheelchair accessibility ramp.',
        location: {
          lat: 37.7578,
          lng: -122.4132,
          geohash: encodeGeohash(37.7578, -122.4132),
        },
        neighborhoodId: 'mission_district',
        departmentId: 'sanitation',
        priority: 'medium',
        mediaUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=400',
        reportedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_1',
        status: 'verifying',
        type: 'other',
        severity: 0.4,
        title: 'Faded pedestrian crosswalk at Harrison & 24th',
        description: 'The zebra stripes are almost completely worn off. Drivers are not slowing down for pedestrians crossing to school.',
        location: {
          lat: 37.7529,
          lng: -122.4124,
          geohash: encodeGeohash(37.7529, -122.4124),
        },
        neighborhoodId: 'mission_district',
        departmentId: 'roads',
        priority: 'low',
        mediaUrl: '',
        reportedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_5',
        status: 'routed',
        type: 'pothole',
        severity: 0.7,
        title: 'Sinking manhole cover on South Van Ness',
        description: 'The asphalt around the circular sewer access is cracking and sinking, creating a deep drop that damages tires.',
        location: {
          lat: 37.7578,
          lng: -122.4172,
          geohash: encodeGeohash(37.7578, -122.4172),
        },
        neighborhoodId: 'mission_district',
        departmentId: 'roads',
        priority: 'high',
        mediaUrl: '',
        reportedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_2',
        status: 'resolved',
        type: 'waste_problem',
        severity: 0.6,
        title: 'Overflowing public trash container at Mission Plaza',
        description: 'Trash is piled up and spilling onto the streets. Attracting pigeons and rats.',
        location: {
          lat: 37.7622,
          lng: -122.4181,
          geohash: encodeGeohash(37.7622, -122.4181),
        },
        neighborhoodId: 'mission_district',
        departmentId: 'sanitation',
        priority: 'medium',
        mediaUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=400',
        reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        reporterId: 'seed_user_3',
        status: 'pending',
        type: 'pothole',
        severity: 0.3,
        title: 'Damaged sidewalk tree basin on 21st St',
        description: 'The concrete surrounding the tree is buckled upwards. Massive tripping hazard for elderly residents.',
        location: {
          lat: 37.7570,
          lng: -122.4150,
          geohash: encodeGeohash(37.7570, -122.4150),
        },
        neighborhoodId: 'mission_district',
        departmentId: 'roads',
        priority: 'low',
        mediaUrl: '',
        reportedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },

      // North Beach Issues
      {
        reporterId: 'seed_user_6',
        status: 'in_progress',
        type: 'pothole',
        severity: 0.85,
        title: 'Massive pothole on Columbus Ave',
        description: 'Extremely deep pothole on Columbus Ave near Vallejo St. Causes cars to swerve suddenly, which is super risky for pedestrians.',
        location: {
          lat: 37.8011,
          lng: -122.4095,
          geohash: encodeGeohash(37.8011, -122.4095),
        },
        neighborhoodId: 'north_beach',
        departmentId: 'roads',
        priority: 'high',
        mediaUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=400',
        reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_7',
        status: 'routed',
        type: 'broken_streetlight',
        severity: 0.7,
        title: 'Broken lamp post in Washington Square Park',
        description: 'One of the historical lamp posts inside the main park pathway is completely offline. Creating dark spots.',
        location: {
          lat: 37.8018,
          lng: -122.4101,
          geohash: encodeGeohash(37.8018, -122.4101),
        },
        neighborhoodId: 'north_beach',
        departmentId: 'parks_environment',
        priority: 'medium',
        mediaUrl: '',
        reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_8',
        status: 'resolved',
        type: 'water_leak',
        severity: 0.95,
        title: 'Leaking fire hydrant on Grant Ave',
        description: 'Fire hydrant cap is cracked and spraying a strong stream of clean water into the street gutter.',
        location: {
          lat: 37.7985,
          lng: -122.4072,
          geohash: encodeGeohash(37.7985, -122.4072),
        },
        neighborhoodId: 'north_beach',
        departmentId: 'water_drainage',
        priority: 'critical',
        mediaUrl: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&q=80&w=400',
        reportedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        reporterId: 'seed_user_6',
        status: 'pending',
        type: 'waste_problem',
        severity: 0.5,
        title: 'Trash accumulation in alley near Green St',
        description: 'Numerous bags of household and retail garbage left piled outside of bins, creating terrible odors and attracting vermin.',
        location: {
          lat: 37.7996,
          lng: -122.4068,
          geohash: encodeGeohash(37.7996, -122.4068),
        },
        neighborhoodId: 'north_beach',
        departmentId: 'sanitation',
        priority: 'medium',
        mediaUrl: '',
        reportedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_9',
        status: 'verifying',
        type: 'other',
        severity: 0.8,
        title: 'Damaged traffic signal at Broadway & Stockton',
        description: 'The pedestrian walking sign is shattered and does not illuminate, so walkers cannot tell when they have the right of way.',
        location: {
          lat: 37.7981,
          lng: -122.4089,
          geohash: encodeGeohash(37.7981, -122.4089),
        },
        neighborhoodId: 'north_beach',
        departmentId: 'electrical_lighting',
        priority: 'high',
        mediaUrl: '',
        reportedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_7',
        status: 'in_progress',
        type: 'broken_streetlight',
        severity: 0.9,
        title: 'Exposed electrical wiring at streetlight base',
        description: 'The metal plate covering the electrical wires at the base of the lamppost is missing. Extremely hazardous!',
        location: {
          lat: 37.8032,
          lng: -122.4082,
          geohash: encodeGeohash(37.8032, -122.4082),
        },
        neighborhoodId: 'north_beach',
        departmentId: 'electrical_lighting',
        priority: 'critical',
        mediaUrl: '',
        reportedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      },
      {
        reporterId: 'seed_user_8',
        status: 'pending',
        type: 'water_leak',
        severity: 0.65,
        title: 'Blocked storm drain causing flooding on Vallejo',
        description: 'The street drain is completely clogged with leaves and plastic debris, causing rain water to pool into a deep lake.',
        location: {
          lat: 37.7991,
          lng: -122.4112,
          geohash: encodeGeohash(37.7991, -122.4112),
        },
        neighborhoodId: 'north_beach',
        departmentId: 'water_drainage',
        priority: 'medium',
        mediaUrl: '',
        reportedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
      }
    ];

    for (let i = 0; i < issuesList.length; i++) {
      const issueId = `seed_issue_${i + 1}`;
      const issueDoc: Issue = {
        id: issueId,
        ...issuesList[i],
      };
      await setDoc(doc(db, 'issues', issueId), issueDoc);
    }
    console.log(`Seeded ${issuesList.length} issues successfully.`);
    console.log('Firestore Database Seeding Complete!');
  } catch (err) {
    console.error('Error during database seeding:', err);
  }
}
