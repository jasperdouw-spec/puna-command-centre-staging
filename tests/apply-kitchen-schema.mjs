import {assertSyntheticContext} from './disposable-context.mjs';
assertSyntheticContext();
process.argv=['node','scripts/migrate.mjs','--migration=009_live_inventory','--apply'];
await import('../scripts/migrate.mjs');
