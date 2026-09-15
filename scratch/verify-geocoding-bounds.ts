import 'dotenv/config';
import {
  TAMIL_NADU_BOUNDS,
  isWithinTamilNaduBounds,
  isTamilNaduState,
  resolveLocationTiered,
} from '../src/lib/location/geocoder';
import { routeLeadToBranch } from '../src/lib/location/routing';

async function runTests() {
  console.log('--- TEST 1: TAMIL_NADU_BOUNDS Constants ---');
  console.assert(TAMIL_NADU_BOUNDS.minLat === 8.08, 'minLat should be 8.08');
  console.assert(TAMIL_NADU_BOUNDS.maxLat === 13.55, 'maxLat should be 13.55');
  console.assert(TAMIL_NADU_BOUNDS.minLon === 76.23, 'minLon should be 76.23');
  console.assert(TAMIL_NADU_BOUNDS.maxLon === 80.35, 'maxLon should be 80.35');
  console.log('✓ TAMIL_NADU_BOUNDS constants verified');

  console.log('\n--- TEST 2: Coordinate Bounding Function ---');
  // Inside Tamil Nadu
  console.assert(isWithinTamilNaduBounds(11.0168, 76.9558), 'Coimbatore must be within bounds');
  console.assert(isWithinTamilNaduBounds(9.9252, 78.1198), 'Madurai must be within bounds');
  console.assert(isWithinTamilNaduBounds(13.0827, 80.2707), 'Chennai must be within bounds');
  console.assert(isWithinTamilNaduBounds(8.0883, 77.5385), 'Kanyakumari must be within bounds');
  console.assert(isWithinTamilNaduBounds(11.9416, 79.8083), 'Puducherry must be within bounds');

  // Outside Tamil Nadu
  console.assert(!isWithinTamilNaduBounds(19.076, 72.8777), 'Mumbai must be outside bounds');
  console.assert(!isWithinTamilNaduBounds(28.6139, 77.209), 'Delhi must be outside bounds');
  console.assert(!isWithinTamilNaduBounds(17.385, 78.4867), 'Hyderabad must be outside bounds');
  console.assert(!isWithinTamilNaduBounds(7.5, 77.5), 'South of Kanyakumari must be outside bounds');
  console.assert(!isWithinTamilNaduBounds(14.0, 80.0), 'North of Pulicat must be outside bounds');
  console.log('✓ isWithinTamilNaduBounds spatial checks passed');

  console.log('\n--- TEST 3: State Classification ---');
  console.assert(isTamilNaduState('Tamil Nadu'), 'Tamil Nadu is TN');
  console.assert(isTamilNaduState('Tamilnadu'), 'Tamilnadu is TN');
  console.assert(isTamilNaduState('Puducherry'), 'Puducherry is valid');
  console.assert(!isTamilNaduState('Karnataka'), 'Karnataka is not TN');
  console.assert(!isTamilNaduState('Maharashtra'), 'Maharashtra is not TN');
  console.assert(!isTamilNaduState('Kerala'), 'Kerala is not TN');
  console.log('✓ State classification passed');

  console.log('\n--- TEST 4: Tiered Resolver & Routing Out-of-State Fence ---');
  // Test local TN resolution
  const cbeResult = await routeLeadToBranch('Coimbatore');
  console.log('Coimbatore route status:', cbeResult.status, 'branch:', cbeResult.assignedBranch?.name);
  console.assert(cbeResult.status === 'assigned', 'Coimbatore must be assigned to a branch');
  console.assert(cbeResult.isOutOfState === false, 'Coimbatore is not out of state');

  // Test out-of-state locations
  const outOfStateLocations = ['Mumbai', 'New Delhi', 'Kolkata'];
  for (const loc of outOfStateLocations) {
    const res = await routeLeadToBranch(loc);
    console.log(`${loc} status:`, res.status, 'isOutOfState:', res.isOutOfState, 'branch:', res.assignedBranch);
    console.assert(
      res.status === 'out_of_state' || res.status === 'unresolved',
      `${loc} must not be assigned to a TN dealership branch`
    );
    console.assert(res.assignedBranch === null, `${loc} assignedBranch must be null`);
  }
  console.log('✓ Out-of-state routing isolation verified');

  console.log('\n🎉 ALL PHASE 10 GEODATA BOUNDING TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
