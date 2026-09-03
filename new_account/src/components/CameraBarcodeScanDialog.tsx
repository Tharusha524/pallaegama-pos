import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Alert,
  FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

interface CameraBarcodeScanDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

/**
 * Optional alternative to a USB/handheld barcode scanner: decodes barcodes
 * live from the device's webcam using ZXing. Purely additive — the primary
 * "type + Enter" scan input (for real USB scanners) is unchanged.
 *
 * Many laptops (Windows Hello ones especially) expose TWO cameras — a normal
 * RGB webcam and an infrared camera used only for face login. The infrared
 * one shows as a solid black feed under normal light. So this dialog lets
 * the user pick which camera to use instead of trusting the browser default,
 * and tries to skip any device whose label mentions "infrared"/"IR" by default.
 */
export default function CameraBarcodeScanDialog({ open, onClose, onDetected }: CameraBarcodeScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

  // Enumerate cameras once the dialog opens. Labels are only populated once
  // permission has been granted at least once, so we request a throwaway
  // stream first if needed just to unlock device labels.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        let list = await navigator.mediaDevices.enumerateDevices();
        let videoInputs = list.filter((d) => d.kind === "videoinput");

        if (videoInputs.some((d) => !d.label)) {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach((t) => t.stop());
          list = await navigator.mediaDevices.enumerateDevices();
          videoInputs = list.filter((d) => d.kind === "videoinput");
        }

        if (cancelled) return;
        setDevices(videoInputs);

        const preferred =
          videoInputs.find((d) => !/infrared|ir camera|ir\b/i.test(d.label)) ?? videoInputs[0];
        setDeviceId((prev) => prev || preferred?.deviceId || "");
      } catch {
        // Permission/enumeration failed — the decode effect below will
        // surface a proper error once it tries to open a stream.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !deviceId) return;

    let cancelled = false;
    setError(null);
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(deviceId, videoRef.current ?? undefined, (result, _err, controls) => {
        if (cancelled) return;
        controlsRef.current = controls;
        if (result) {
          onDetected(result.getText());
        }
        // NotFoundException fires continuously while no barcode is in view —
        // that's normal scanning noise, not a real error; ignore it.
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.name === "NotAllowedError"
            ? "Camera access was denied. Allow camera permission for this site and try again."
            : "Could not access this camera."
        );
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, deviceId, onDetected]);

  const handleClose = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Scan with Camera</DialogTitle>
      <DialogContent>
        {devices.length > 1 && (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Camera</InputLabel>
            <Select
              value={deviceId}
              label="Camera"
              onChange={(e) => setDeviceId(e.target.value)}
            >
              {devices.map((d, i) => (
                <MenuItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Box sx={{ position: "relative", width: "100%", borderRadius: 2, overflow: "hidden", bgcolor: "black" }}>
            <video ref={videoRef} style={{ width: "100%", display: "block" }} muted playsInline autoPlay />
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Point the camera at a product barcode — it adds to the cart automatically once detected.
          {devices.length > 1 && " If the preview is black, try a different camera above — some laptops have a separate infrared camera for face login that shows black under normal light."}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
