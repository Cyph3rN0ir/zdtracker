import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ErrorBox({ error }: { error: any }) {
  const msg = error?.message ?? String(error);
  const pfHint =
    /personal_(transactions|accounts|categories|counterparties|loans|budgets)|account_id|category_id|counterparty_id|linked_loan_id|transfer_account_id/i.test(
      msg,
    );
  const missingTable = /does not exist|schema cache|relation .* does not exist/i.test(msg);
  return (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        <div className="[overflow-wrap:anywhere]">{msg}</div>
        {pfHint ? (
          <div className="text-xs opacity-70 mt-2">
            Personal-finance schema is missing. Run <code>SUPABASE_PERSONAL_FINANCE.sql</code> in
            your Supabase SQL editor (idempotent, safe to re-run).
          </div>
        ) : missingTable ? (
          <div className="text-xs opacity-70 mt-2">
            Missing table. Run <code>SUPABASE_SETUP.sql</code> (and then{" "}
            <code>SUPABASE_PERSONAL_FINANCE.sql</code> if you use the personal tracker) in your
            Supabase SQL editor.
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
