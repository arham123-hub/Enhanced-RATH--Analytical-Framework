import { getFileIconName } from '../../../../utils/fileIconMapper';

/**
 * Get file icon name using local font-based icons instead of external CDN images
 */
const getFileIcon = (fileName: string): string => {
    return getFileIconName(fileName);
};

export default getFileIcon;
