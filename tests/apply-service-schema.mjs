import {assertSyntheticContext} from './disposable-context.mjs';
assertSyntheticContext();
process.argv=['node','scripts/migrate.mjs','--migration=010_kitchen_service','--apply'];
await import('../scripts/migrate.mjs');
