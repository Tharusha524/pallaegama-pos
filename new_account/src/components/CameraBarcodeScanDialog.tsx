import { useEffect, useRef, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Alert } from "@mui/material";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

interface CameraBarcodeScanDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

/**
 * Optional alternative to a USB/handheld barcode scanner: decodes barcodes
 * live from the device's webcam/laptop camera using ZXing. Purely additive —
 * the primary "type + Enter" scan input (for real USB scanners) is unchanged.
 */
export default function CameraBarcodeScanDialog({ open, onClose, onDetected }: CameraBarcodeScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, err, controls) => {
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
            : "Could not access a camera on this device."
        );
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  const handleClose = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Scan with Camera</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Box sx={{ position: "relative", width: "100%", borderRadius: 2, overflow: "hidden", bgcolor: "black" }}>
            <video ref={videoRef} style={{ width: "100%", display: "block" }} muted playsInline />
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Point the camera at a product barcode — it adds to the cart automatically once detected.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
