import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
// src/components/BackupRestore/BackupRestore.tsx

import React, { useState, useEffect } from "react";
import {
    Box,
    Stack,
    Typography,
    TextField,
    Button,
    Divider,
    Grid,
    MenuItem,
    FormControl,
    FormControlLabel,
    RadioGroup,
    Radio,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Snackbar,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tooltip,
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RestoreIcon from '@mui/icons-material/Restore';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadIcon from '@mui/icons-material/Upload';
import AddIcon from '@mui/icons-material/Add';
import theme from "../../../../theme";
import { backupApiService, CreateBackupRequest, Backup } from "../../../../api/backup/BackupApi";
import { useAuth } from "../../../../context/AuthContext";

export default function BackupRestore() {
    const { hasEditPermission } = useAuth();
    const canEdit = hasEditPermission('Database backup/restore');
    // State management
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Data state
    const [backups, setBackups] = useState<Backup[]>([]);
    const [formData, setFormData] = useState<CreateBackupRequest>({
        comments: "",
        compression: "none",
        include_data: true,
        include_schema: true,
    });
    
    // UI state
    const [selectedBackupId, setSelectedBackupId] = useState<number | null>(null);
    const [securitySetting, setSecuritySetting] = useState<string>("Protect Security Settings");
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    
    // Dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        action: () => Promise<void>;
    }>({
        open: false,
        title: "",
        message: "",
        action: async () => {},
    });

    // Load backups on component mount
    useEffect(() => {
        fetchBackups();
    }, []);

    // Auto-hide messages after 5 seconds
    useEffect(() => {
        if (successMessage || error) {
            const timer = setTimeout(() => {
                clearMessages();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, error]);

    // API wrapper with loading and error handling
    const executeApiCall = async <T,>(apiCall: () => Promise<T>): Promise<T | null> => {
        setLoading(true);
        clearMessages();
        
        try {
            const result = await apiCall();
            setLoading(false);
            return result;
        } catch (err: any) {
            console.error('API Error:', err);
            setError(err.message || 'An error occurred');
            setLoading(false);
            return null;
        }
    };

    const clearMessages = () => {
        setError(null);
        setSuccessMessage(null);
    };

    const fetchBackups = async () => {
        const result = await executeApiCall(() => backupApiService.getBackups());
        if (result) {
            setBackups(result);
        }
    };

    const handleCreateBackup = async () => {
        const result = await executeApiCall(() => backupApiService.createBackup(formData));
        if (result) {
            setSuccessMessage(result.message);
            await fetchBackups();
            // Reset form
            setFormData({
                ...formData,
                comments: "",
            });
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            
            // Validate file type
            const validExtensions = ['.sql', '.zip', '.gz'];
            const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            
            if (!validExtensions.includes(fileExtension)) {
                setError('Please select a valid file (.sql, .zip, .gz)');
                return;
            }
            
            // Validate file size (100MB max)
            if (file.size > 100 * 1024 * 1024) {
                setError('File size must be less than 100MB');
                return;
            }
            
            setFileToUpload(file);
            setSuccessMessage(`Selected file: ${file.name}`);
        }
    };

    const handleUploadBackup = async () => {
        if (!fileToUpload) {
            setError('Please select a file to upload');
            return;
        }

        const result = await executeApiCall(() => 
            backupApiService.uploadBackup(fileToUpload)
        );
        
        if (result) {
            setSuccessMessage(result.message);
            setFileToUpload(null);
            await fetchBackups();
        }
    };

    const handleViewBackup = async (id: number) => {
        try {
            setLoading(true);
            clearMessages();
            await backupApiService.viewBackupContent(id);
            setLoading(false);
        } catch (err: any) {
            setError(err.message || 'Failed to view backup');
            setLoading(false);
        }
    };

    const handleDownloadBackup = async (id: number) => {
        try {
            setLoading(true);
            clearMessages();
            await backupApiService.downloadBackupFile(id);
            setLoading(false);
        } catch (err: any) {
            setError(err.message || 'Failed to download backup');
            setLoading(false);
        }
    };

    const handleRestoreBackup = async (id: number) => {
        setConfirmDialog({
            open: true,
            title: "Confirm Database Restore",
            message: "WARNING: This will overwrite your current database with the selected backup. This action cannot be undone. Are you sure you want to proceed?",
            action: async () => {
                const result = await executeApiCall(() => backupApiService.restoreBackup(id));
                if (result) {
                    setSuccessMessage(result.message);
                }
                setConfirmDialog({ ...confirmDialog, open: false });
            }
        });
    };

    const handleDeleteBackup = async (id: number) => {
        setConfirmDialog({
            open: true,
            title: "Confirm Delete",
            message: "Are you sure you want to delete this backup? This action cannot be undone.",
            action: async () => {
                const result = await executeApiCall(() => backupApiService.deleteBackup(id));
                if (result) {
                    setSuccessMessage(result.message);
                    await fetchBackups();
                    if (selectedBackupId === id) {
                        setSelectedBackupId(null);
                    }
                }
                setConfirmDialog({ ...confirmDialog, open: false });
            }
        });
    };

    const handleCloseConfirmDialog = () => {
        setConfirmDialog({ ...confirmDialog, open: false });
    };

    const getCompressionIcon = (compression: string) => {
        switch (compression) {
            case 'zip': return <RestoreIcon fontSize="small" />;
            case 'gzip': return <RestoreIcon fontSize="small" />;
            default: return <DeleteIcon fontSize="small" />;
        }
    };

    const getCompressionColor = (compression: string) => {
        switch (compression) {
            case 'zip': return "#0288d1"; // Blue
            case 'gzip': return "#0288d1"; // Blue
            default: return "#757575"; // Grey
        }
    };

    return (
        <FormPageLayout>
            {/* Success/Error Messages */}
            <Snackbar 
                open={!!successMessage} 
                autoHideDuration={5000}
                onClose={clearMessages}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="success" onClose={clearMessages}>
                    {successMessage}
                </Alert>
            </Snackbar>
            <Snackbar 
                open={!!error} 
                autoHideDuration={10000}
                onClose={clearMessages}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="error" onClose={clearMessages}>
                    {error}
                </Alert>
            </Snackbar>
            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialog.open}
                onClose={handleCloseConfirmDialog}
            >
                <DialogTitle>{confirmDialog.title}</DialogTitle>
                <DialogContent>
                    <Typography>{confirmDialog.message}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseConfirmDialog} color="primary">
                        Cancel
                    </Button>
                    <Button 
                        onClick={confirmDialog.action} 
                        color="primary" 
                        variant="contained"
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Confirm'}
                    </Button>
                </DialogActions>
            </Dialog>
            <Box
                sx={{
                    width: "100%",
                    maxWidth: "1200px",
                    p: theme.spacing(3),
                    boxShadow: theme.shadows[2],
                    borderRadius: theme.shape.borderRadius,
                    backgroundColor: theme.palette.background.paper,
                }}
            >
                {/* Header */}
                <Typography variant="h5" sx={{ mb: 3 }}>
                    Database Backup & Restore
                </Typography>

                {/* Loading Indicator */}
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                        <CircularProgress />
                        <Typography variant="body2" sx={{ ml: 2, alignSelf: 'center' }}>
                            Processing...
                        </Typography>
                    </Box>
                )}

                <Grid container spacing={4}>
                    {/* Left Column - Create Backup */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                                    Create New Backup
                                </Typography>
                                <Divider />
                                
                                <Stack spacing={2} sx={{ mt: 2 }}>
                                    <TextField
                                        label="Backup Comments (Optional)"
                                        value={formData.comments}
                                        onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                                        size="small"
                                        fullWidth
                                        multiline
                                        rows={2}
                                        placeholder="Add a description for this backup..."
                                    />

                                    <TextField
                                        select
                                        label="Compression Type"
                                        value={formData.compression}
                                        onChange={(e) => setFormData({ ...formData, compression: e.target.value as any })}
                                        size="small"
                                        fullWidth
                                    >
                                        <MenuItem value={"none"}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <span>📄</span>
                                                <span>No Compression (SQL)</span>
                                            </Stack>
                                        </MenuItem>
                                        <MenuItem value={"zip"}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <span>🗜️</span>
                                                <span>ZIP Compression</span>
                                            </Stack>
                                        </MenuItem>
                                        <MenuItem value={"gzip"}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <span>🗜️</span>
                                                <span>GZIP Compression</span>
                                            </Stack>
                                        </MenuItem>
                                    </TextField>

                                    <Button
                                        variant="contained"
                                        onClick={handleCreateBackup}
                                        disabled={loading || !canEdit}
                                        startIcon={<AddIcon />}
                                        sx={{ 
                                            backgroundColor: theme.palette.primary.main,
                                            '&:hover': {
                                                backgroundColor: theme.palette.primary.dark,
                                            }
                                        }}
                                    >
                                        Create Backup
                                    </Button>
                                </Stack>
                            </Box>

                            {/* Upload Backup */}
                            <Box>
                                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                                    Upload Existing Backup
                                </Typography>
                                <Divider />
                                
                                <Stack spacing={2} sx={{ mt: 2 }}>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Button 
                                            variant="outlined" 
                                            component="label"
                                            disabled={loading}
                                            startIcon={<UploadIcon />}
                                        >
                                            Choose Backup File
                                            <input
                                                type="file"
                                                hidden
                                                onChange={handleFileSelect}
                                                accept=".sql,.zip,.gz"
                                            />
                                        </Button>
                                        {fileToUpload && (
                                            <Typography variant="body2" color="textSecondary">
                                                Selected: {fileToUpload.name}
                                            </Typography>
                                        )}
                                    </Stack>
                                    
                                    <Button
                                        variant="outlined"
                                        onClick={handleUploadBackup}
                                        disabled={!fileToUpload || loading || !canEdit}
                                        color="secondary"
                                    >
                                        Upload Backup
                                    </Button>
                                    
                                    <Typography variant="caption" color="textSecondary">
                                        Supported formats: .sql, .zip, .gz (Max 100MB)
                                    </Typography>
                                </Stack>
                            </Box>
                        </Stack>
                    </Grid>

                    {/* Right Column - Backup List */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={3}>
                            <Box>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                        Existing Backups ({backups.length})
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        Select a backup to perform actions
                                    </Typography>
                                </Stack>
                                <Divider />
                                
                                {backups.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                                        <Typography color="textSecondary" gutterBottom>
                                            No backups found in the system.
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            If you have a manual SQL dump, you can upload it above or place it in the backend root directory and click "Refresh List".
                                        </Typography>
                                    </Box>
                                ) : (
                                    <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 400 }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Backup Name</TableCell>
                                                    <TableCell align="right">Size</TableCell>
                                                    <TableCell align="center">Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {backups.map((backup) => (
                                                    <TableRow
                                                        key={backup.id}
                                                        hover
                                                        selected={selectedBackupId === backup.id}
                                                        onClick={() => setSelectedBackupId(backup.id)}
                                                        sx={{ cursor: 'pointer' }}
                                                    >
                                                        <TableCell>
                                                            <Stack spacing={0.5}>
                                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                                    <span>{getCompressionIcon(backup.compression)}</span>
                                                                    <Typography variant="body2" noWrap>
                                                                        {backup.name}
                                                                    </Typography>
                                                                </Stack>
                                                                <Stack direction="row" spacing={2}>
                                                                    <Typography 
                                                                        variant="caption" 
                                                                        sx={{ 
                                                                            px: 1, 
                                                                            borderRadius: 1,
                                                                            backgroundColor: getCompressionColor(backup.compression),
                                                                            color: 'white',
                                                                        }}
                                                                    >
                                                                        {backup.compression === 'none' ? 'SQL' : backup.compression.toUpperCase()}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="textSecondary">
                                                                        {backup.createdAt}
                                                                    </Typography>
                                                                </Stack>
                                                                {backup.comments && (
                                                                    <Typography variant="caption" color="textSecondary" noWrap>
                                                                        {backup.comments}
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2">
                                                                {backup.size}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Stack direction="row" spacing={0.5} justifyContent="center">
                                                                <Tooltip title="View Backup">
                                                                    <IconButton 
                                                                        size="small" 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleViewBackup(backup.id);
                                                                        }}
                                                                        disabled={loading}
                                                                    >
                                                                        <VisibilityIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Download Backup">
                                                                    <IconButton 
                                                                        size="small" 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDownloadBackup(backup.id);
                                                                        }}
                                                                        disabled={loading}
                                                                    >
                                                                        <DownloadIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Restore Database">
                                                                    <IconButton 
                                                                        size="small" 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRestoreBackup(backup.id);
                                                                        }}
                                                                        disabled={loading || !canEdit}
                                                                        sx={{ color: "#ed6c02" }}
                                                                    >
                                                                        <RestoreIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Delete Backup">
                                                                    <IconButton 
                                                                        size="small" 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteBackup(backup.id);
                                                                        }}
                                                                        disabled={loading || !canEdit}
                                                                        sx={{ color: "#d32f2f" }}
                                                                    >
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Stack>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Box>

                            {/* Security Settings */}
                            <Box>
                                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                                    Security Settings
                                </Typography>
                                <Divider />
                                
                                <FormControl component="fieldset" sx={{ mt: 2 }}>
                                    <RadioGroup
                                        value={securitySetting}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSecuritySetting(val);
                                            setSuccessMessage(`Security settings updated to: ${val}`);
                                        }}
                                    >
                                        <FormControlLabel 
                                            value="Update Security Settings" 
                                            control={<Radio size="small" />} 
                                            label="Update Security Settings" 
                                        />
                                        <FormControlLabel 
                                            value="Protect Security Settings" 
                                            control={<Radio size="small" />} 
                                            label="Protect Security Settings" 
                                        />
                                    </RadioGroup>
                                </FormControl>
                            </Box>

                            {/* Footer Actions */}
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    mt: theme.spacing(4),
                                    flexDirection: { xs: "column", sm: "row" },
                                    gap: theme.spacing(2),
                                }}
                            >
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => window.history.back()}
                                >
                                    Back
                                </Button>
                                
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={fetchBackups}
                                    disabled={loading}
                                    startIcon={<RefreshIcon />}
                                >
                                    Refresh List
                                </Button>
                            </Box>
                        </Stack>
                    </Grid>
                </Grid>
            </Box>
        </FormPageLayout>
    );
}