<?php

/**
 * APIs that work without a staff login. Everything else under /api needs one
 * (see EnsureStaffApi). Paths are relative to /api; * matches anything.
 */
return [
    'GET' => [
        'login-slideshow-images',
        'storage-file/*',
        'company-setup/logo',
        'company-setup/settings',
        // Opened in a new browser tab, which can't send the token.
        'entity-attachments/*/download',
        'mobile/*',
    ],
    'POST' => [
        'login',
    ],
    // Customer app: register/login are open, the rest has its own customer.auth check.
    'ANY' => [
        'customer/*',
    ],
];
