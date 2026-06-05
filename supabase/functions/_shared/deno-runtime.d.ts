declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

declare module "@supabase/supabase-js" {
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
}

declare module "stripe" {
  const Stripe: any;
  export default Stripe;
}
