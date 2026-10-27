import { NextResponse } from 'next/server';
import { authorizeUser } from '../../../util';
import { KarateTechApiClient } from '@/lib/integrations/karatetech-sync';
export const dynamic = 'force-dynamic';
export async function GET(request:Request,context:{params:Promise<{tournamentId:string}>}) {
  const auth=await authorizeUser(request);if(auth.error)return auth.error;
  try {
    const {tournamentId}=await context.params;
    return NextResponse.json({success:true,categories:await KarateTechApiClient.getTournamentCategories(tournamentId)});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:'Unable to load tournament categories.'},{status:502});}
}
