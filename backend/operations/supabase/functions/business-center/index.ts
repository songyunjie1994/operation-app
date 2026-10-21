import {serve} from '../_shared/ingest.ts';
Deno.serve((req:Request)=>serve(req,'business'));
