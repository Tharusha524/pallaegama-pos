import React, { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import { getStorageFileTypeFromName } from "../utils/StorageFiles.util";
import { getApiBaseUrl } from "../config/backendConfig";

type StorageFile = {
  gsutil_uri?: string;
  imageUrl?: string;
  fileName?: string;
};

type ProfileImageProps = {
  name?: string;
  files?: (File | StorageFile)[];
  imageUrl?: string; // Direct image URL
  size?: string;
  fontSize?: string;
  onClick?: () => void;
};

const ProfileImage: React.FC<ProfileImageProps> = ({
  name,
  files = [],
  imageUrl,
  size = "12rem",
  onClick,
  fontSize
}) => {
  // Priority: imageUrl prop > files array > fallback to initials
  // Build initial URL or preview from files
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    // If files includes a File we should createObjectURL in effect (not during render)
    let objectUrl: string | undefined;
    const firstImageFile = files.find((file) => {
      const fileName = file instanceof File ? file.name : (file as StorageFile).fileName;
      return getStorageFileTypeFromName(fileName || "") === "image";
    });

    if (firstImageFile instanceof File) {
      objectUrl = URL.createObjectURL(firstImageFile);
      setPreviewUrl(objectUrl);
    } else if (firstImageFile && !(firstImageFile instanceof File)) {
      // StorageFile with imageUrl
      setPreviewUrl((firstImageFile as StorageFile).imageUrl);
    } else {
      setPreviewUrl(undefined);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [files]);

  const initialUrl = imageUrl ?? previewUrl;

  // Normalize and try candidate URLs. If backend returns a relative path like
  // "profile_images/....jpg" we try: [value, <base>/storage/<value>, <base>/<value>]
  const [candidates, setCandidates] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    setCurrentIndex(0);
    if (!initialUrl) {
      setCandidates([]);
      setCurrentSrc(undefined);
      return;
    }

    const trimmed = String(initialUrl).trim();
    // If it's already a data URL, blob URL, or full http(s) URL, use it as-is
    if (trimmed.startsWith("data:") || trimmed.startsWith("blob:") || /^https?:\/\//i.test(trimmed)) {
      setCandidates([trimmed]);
      setCurrentSrc(trimmed);
      return;
    }

    // Relative paths (e.g. profile_images/...) are served from /storage, not /api
    const apiBase = (getApiBaseUrl() || "").replace(/\/+$/, "");
    const appBase = apiBase.replace(/\/api$/i, "") || window.location.origin;
    const path = trimmed.replace(/^\//, "");
    const cands = [
      `${appBase}/storage/${path}`,
      `${appBase}/${path}`,
    ];
    if (apiBase) {
      cands.push(`${apiBase}/${path}`);
    }

    // unique
    const unique = Array.from(new Set(cands));
    setCandidates(unique);
    setCurrentSrc(unique[0]);
  }, [initialUrl]);

  // when currentIndex changes, advance src if available
  useEffect(() => {
    if (candidates && candidates.length > 0) {
      setCurrentSrc(candidates[Math.min(currentIndex, candidates.length - 1)]);
    } else {
      setCurrentSrc(undefined);
    }
  }, [currentIndex, candidates]);

  return (
    <Avatar
      onClick={onClick}
      sx={{
        bgcolor: "var(--pallet-light-blue)",
        height: size,
        width: size,
        fontSize: fontSize,
        cursor: onClick ? "pointer" : "default",
      }}
      src={currentSrc}
      imgProps={{
        onError: (e) => {
          // try next candidate if available
          const next = currentIndex + 1;
          if (candidates && next < candidates.length) {
            console.debug("ProfileImage: failed to load, trying next candidate", candidates[next]);
            setCurrentIndex(next);
            return;
          }
          console.warn("Failed to load profile image:", currentSrc);
          // hide broken image element
          (e.target as HTMLImageElement).style.display = "none";
        },
      }}
    >
      {!currentSrc && name?.charAt(0).toUpperCase()}
    </Avatar>
  );
};

export default ProfileImage;