import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { EnablePushButton } from "@/components/push/EnablePushButton";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — ZeroSync" }] }),
});

function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Manage notifications and device preferences." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Push notifications</CardTitle>
          <CardDescription>
            Get notified about new chat messages even when ZeroSync isn't open. On iPhone, install
            the app to your Home Screen first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnablePushButton />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
