import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { EnablePushButton } from "@/components/push/EnablePushButton";
import {
  downloadOfflineData,
  type OfflineDownloadProgress,
  type OfflineDownloadResult,
} from "@/lib/offline-warmup";
import { useOfflineStatus } from "@/lib/offline-status";
import { useOfflineLoaders } from "@/lib/offline-loaders";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — ZeroSync" }] }),
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const offlineLoaders = useOfflineLoaders();
  const { isOnline } = useOfflineStatus();
  const [progress, setProgress] = useState<OfflineDownloadProgress | null>(null);
  const [lastDownload, setLastDownload] = useState<OfflineDownloadResult | null>(null);

  async function download() {
    setProgress({ phase: "Starting download", completed: 0, total: 6 });
    try {
      const result = await downloadOfflineData(queryClient, offlineLoaders, setProgress);
      setLastDownload(result);
      toast.success("Offline data downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Offline download failed");
    } finally {
      setProgress(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        subtitle="Manage offline data, notifications, and device preferences."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" /> Offline access
          </CardTitle>
          <CardDescription>
            Download your businesses, personal finances, tasks, notebook, conversations, and recent
            messages onto this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress ? (
            <div className="space-y-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="truncate">{progress.phase}</span>
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <Progress value={(progress.completed / progress.total) * 100} />
            </div>
          ) : lastDownload ? (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                <div className="font-medium">Available offline on this device</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {lastDownload.businesses} businesses · {lastDownload.profiles} profiles ·{" "}
                  {lastDownload.conversations} conversations · {lastDownload.queryCount} data sets
                </div>
              </div>
            </div>
          ) : null}

          <Button
            className="w-full sm:w-auto"
            onClick={download}
            disabled={!isOnline || !!progress}
          >
            {progress ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {progress ? "Downloading…" : "Download for offline use"}
          </Button>
          {!isOnline && (
            <p className="text-xs text-muted-foreground">
              Connect to the internet to download or refresh offline data.
            </p>
          )}
        </CardContent>
      </Card>

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
