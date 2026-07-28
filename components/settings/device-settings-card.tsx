"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  generateDevicePairingCode,
  saveDeviceSettings,
} from "@/app/(app)/settings/actions";
import type { DeviceView } from "@/lib/iot/schemas";

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function DeviceEditor({ device }: { device: DeviceView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(device.name);
  const [brightness, setBrightness] = useState(device.brightness);
  const [volume, setVolume] = useState(device.volume);
  const [moodNudgeEnabled, setMoodNudgeEnabled] = useState(
    device.moodNudgeEnabled,
  );

  function save() {
    startTransition(async () => {
      const result = await saveDeviceSettings({
        deviceId: device.id,
        name,
        brightness,
        volume,
        moodNudgeEnabled,
      });
      if (result.ok) {
        toast.success("Device settings saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function unpair() {
    const response = await fetch("/api/device/unpair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device.id }),
    });
    if (response.ok) {
      toast.success("Device unpaired");
      router.refresh();
      return;
    }
    toast.error("Could not unpair the device");
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{device.name}</h3>
            <Badge variant={device.online ? "default" : "secondary"}>
              {device.online ? "Online" : "Offline"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Paired {formatDate(device.pairedAtISO)} · Last seen{" "}
            {formatDate(device.lastSeenAtISO)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`device-name-${device.id}`}>Device name</Label>
          <Input
            id={`device-name-${device.id}`}
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`brightness-${device.id}`}>Brightness (0–100)</Label>
          <Input
            id={`brightness-${device.id}`}
            type="number"
            min={0}
            max={100}
            value={brightness}
            onChange={(event) => setBrightness(Number(event.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`volume-${device.id}`}>Volume (0–100)</Label>
          <Input
            id={`volume-${device.id}`}
            type="number"
            min={0}
            max={100}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`mood-nudge-${device.id}`}
          checked={moodNudgeEnabled}
          onCheckedChange={(value) => setMoodNudgeEnabled(value === true)}
        />
        <Label htmlFor={`mood-nudge-${device.id}`} className="font-normal">
          Allow an evening mood nudge
        </Label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={isPending || !name.trim()}>
          {isPending ? "Saving…" : "Save device"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="outline">Unpair device</Button>}
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unpair this device?</AlertDialogTitle>
              <AlertDialogDescription>
                The current device token will stop working immediately. Pair the
                device again to reconnect it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep device</AlertDialogCancel>
              <AlertDialogAction onClick={unpair}>
                Unpair device
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function DeviceSettingsCard({
  devices,
  enabled,
}: {
  devices: DeviceView[];
  enabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pairing, setPairing] = useState<{
    code: string;
    expiresAt: number;
  } | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const previousDeviceCount = useRef(devices.length);

  useEffect(() => {
    if (devices.length > previousDeviceCount.current) setPairing(null);
    previousDeviceCount.current = devices.length;
  }, [devices.length]);

  useEffect(() => {
    if (!pairing) return;
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((pairing.expiresAt - Date.now()) / 1000),
      );
      setRemainingSec(remaining);
      if (remaining === 0) setPairing(null);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  function generateCode() {
    startTransition(async () => {
      const result = await generateDevicePairingCode();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPairing({
        code: result.pairingCode,
        expiresAt: new Date(result.expiresAtISO).getTime(),
      });
      toast.success("Pairing code created");
    });
  }

  function copyCode() {
    if (!pairing) return;
    void navigator.clipboard.writeText(pairing.code);
    toast.success("Pairing code copied");
  }

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Connected devices</h2>
          <p className="text-muted-foreground text-sm">
            Pair up to three LUMII desk companions and control their output
            levels.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPairing(null);
            router.refresh();
          }}
          aria-label="Refresh connected devices"
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {!enabled ? (
        <p className="text-muted-foreground rounded-lg border p-4 text-sm">
          Device pairing is not enabled in this environment.
        </p>
      ) : null}

      {devices.map((device) => (
        <DeviceEditor key={device.id} device={device} />
      ))}

      {devices.length === 0 && enabled ? (
        <p className="text-muted-foreground text-sm">
          No devices are paired yet.
        </p>
      ) : null}

      {pairing ? (
        <div className="bg-muted space-y-3 rounded-lg p-4">
          <div>
            <p className="text-sm font-medium">Pairing code</p>
            <p className="font-mono text-3xl tracking-[0.3em]">
              {pairing.code}
            </p>
          </div>
          <p className="text-muted-foreground text-sm">
            Expires in {Math.floor(remainingSec / 60)}:
            {String(remainingSec % 60).padStart(2, "0")}. Enter this code during
            the device&apos;s Wi-Fi setup. A new code replaces this one.
          </p>
          <Button variant="outline" size="sm" onClick={copyCode}>
            <Copy className="size-4" />
            Copy code
          </Button>
        </div>
      ) : (
        <Button
          onClick={generateCode}
          disabled={!enabled || isPending || devices.length >= 3}
          className="self-start"
        >
          {isPending ? "Creating code…" : "Generate pairing code"}
        </Button>
      )}
    </Card>
  );
}
