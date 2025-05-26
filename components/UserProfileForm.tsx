import React, { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { IUser } from '@/models/User'; // Assuming IUser is exported from your User model

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

interface UserProfileFormProps {
  onUpdateSuccess?: () => void;
}

const UserProfileForm = ({ onUpdateSuccess }: UserProfileFormProps) => {
  const { data: session, status, update: updateSession } = useSession();
  const [formData, setFormData] = useState<Partial<IUser>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // State for new photo upload
  // SelectedFile is only for local preview and direct Cloudinary upload, not sent to our backend as a file.
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null); 
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingToCloudinary, setIsUploadingToCloudinary] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Function to refresh the session
  const refreshSession = async () => {
    try {
      await updateSession();
      return true;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      setIsFetching(true);
      fetch('/api/users/me')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch profile data');
          return res.json();
        })
        .then(data => {
          const { _id, email, password, role, createdAt, updatedAt, __v, photoPublicId, ...editableData } = data.user || {};
          // photoPublicId is fetched but not directly editable in the form, kept for reference if needed.
          // Format dateOfBirth for display if it exists
          if (editableData.dateOfBirth) {
            try {
              editableData.dateOfBirth = new Date(editableData.dateOfBirth).toISOString().split('T')[0];
            } catch (e) {
              console.error("Error formatting dateOfBirth for display:", e);
              editableData.dateOfBirth = ''; // Clear if invalid
            }
          }
          setFormData(editableData);
        })
        .catch(err => {
          setMessage({ type: 'error', text: err.message || 'Could not load profile.' });
        })
        .finally(() => setIsFetching(false));
    }
  }, [status, session]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleFileSelectedForUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setPhotoMessage(null);
    setSelectedLocalFile(null);
    if(imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);

    // First check if we have a valid session
    if (!session || !session.user?.id) {
      setPhotoMessage({
        type: 'error', 
        text: 'You must be logged in to upload a photo. Please refresh the page and try again.'
      });
      return;
    }

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        setPhotoMessage({type: 'error', text: "Cloudinary not configured. Cannot upload."}) 
        console.error("Missing Cloudinary config for client-side upload.");
        return;
    }

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!file.type.startsWith('image/')) {
        setPhotoMessage({ type: 'error', text: 'Please select an image file.' });
        e.target.value = ''; 
        return;
      }
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        setPhotoMessage({ type: 'error', text: 'File is too large (max 4MB).' });
        e.target.value = ''; 
        return;
      }
      
      setSelectedLocalFile(file); // Keep track of the file for upload
      const tempPreviewUrl = URL.createObjectURL(file);
      setImagePreview(tempPreviewUrl);

      // --- Automatically start upload to Cloudinary --- 
      setIsUploadingToCloudinary(true);
      setPhotoMessage({type: 'success', text: 'Uploading to Cloudinary...'});

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      try {
        const cloudinaryResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: 'POST',
            body: uploadFormData,
          }
        );
        const cloudinaryData = await cloudinaryResponse.json();

        if (cloudinaryData.secure_url && cloudinaryData.public_id) {
          setPhotoMessage({ type: 'success', text: 'Image uploaded to Cloudinary! Updating profile...' });
          // Now, send this to our backend
          await updateUserProfileWithNewPhoto(cloudinaryData.secure_url, cloudinaryData.public_id, e.target);
        } else {
          console.error('Cloudinary upload failed:', cloudinaryData);
          setPhotoMessage({ type: 'error', text: cloudinaryData.error?.message || 'Cloudinary upload failed.' });
          setSelectedLocalFile(null); // Clear selected file on failure
        }
      } catch (uploadError) {
        console.error('Direct Cloudinary upload error:', uploadError);
        setPhotoMessage({ type: 'error', text: 'Image upload to Cloudinary failed.' });
        setSelectedLocalFile(null); // Clear selected file on failure
      } finally {
        setIsUploadingToCloudinary(false);
        // Do not clear file input here, updateUserProfileWithNewPhoto will do it on final success
      }
    }
  };

  const updateUserProfileWithNewPhoto = async (newPhotoUrl: string, newPhotoPublicId: string, fileInputElement: HTMLInputElement | null) => {
    setPhotoMessage({ type: 'success', text: 'Updating profile with new photo...' });
    setIsLoading(true); // Use general loading for this final step

    try {
      // Check if session exists first to prevent unnecessary API calls
      if (!session || !session.user?.id) {
        throw new Error('Session expired or not available. Please refresh the page and try again.');
      }

      const res = await fetch('/api/users/me/photo', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // No need to add Authorization header - session is handled via cookies
        },
        body: JSON.stringify({ photoUrl: newPhotoUrl, photoPublicId: newPhotoPublicId }),
        credentials: 'include' // Ensure cookies are sent with the request
      });

      // Handle 401 errors specifically
      if (res.status === 401) {
        // Try to refresh the session automatically
        const refreshed = await refreshSession();
        if (!refreshed) {
          throw new Error('Unauthorized: Your session may have expired. Please refresh the page and try again.');
        }
        
        // Try the request again with the refreshed session
        const retryRes = await fetch('/api/users/me/photo', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ photoUrl: newPhotoUrl, photoPublicId: newPhotoPublicId }),
          credentials: 'include'
        });
        
        if (!retryRes.ok) {
          throw new Error('Still unauthorized after session refresh. Please reload the page and try again.');
        }
        
        return await retryRes.json();
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to update profile with new photo (${res.status}).`);
      }

      const data = await res.json();

      setPhotoMessage({ type: 'success', text: 'Profile photo updated successfully!' });
      setFormData(prev => ({ ...prev, photoUrl: newPhotoUrl }));
      
      // Update the session with the new image
      if (session && updateSession) {
        await updateSession({ 
          user: { 
            ...session?.user, 
            image: newPhotoUrl, 
            photoUrl: newPhotoUrl 
          } 
        });
      }
      
      setSelectedLocalFile(null);
      if(fileInputElement) fileInputElement.value = ''; // Reset the file input
      
      // Call the success callback if provided
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
    } catch (err: any) {
      console.error('Photo update error:', err);
      setPhotoMessage({ type: 'error', text: err.message || 'An error occurred while updating profile photo.' });
      
      // If we have a 401 error, display a more helpful message and provide a retry option
      if (err.message && err.message.includes('Unauthorized')) {
        setPhotoMessage({ 
          type: 'error', 
          text: 'Your session has expired. Refresh the page to continue.' 
        });
      }
    } finally {
      setIsLoading(false);
      setIsUploadingToCloudinary(false); // Ensure this is also reset
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target;
    let { value } = e.target; // Make value mutable

    if (name === 'icPassportNo') {
      value = value.replace(/[^a-zA-Z0-9]/g, '');
    } else if (name === 'phone') {
      value = value.replace(/[^\d+]/g, '');
      if (value.length > 1) value = value.replace(/(?!^)[+]/g, '');
      if (value && value !== '+' && !value.startsWith('+')) {
        value = '+' + value.replace(/[+]/g, '');
      }
    } else if (name === 'emergencyContact.phone') {
      value = value.replace(/[^\d+]/g, '');
      if (value.length > 1) value = value.replace(/(?!^)[+]/g, '');
      if (value && value !== '+' && !value.startsWith('+')) {
        value = '+' + value.replace(/[+]/g, '');
      }
    }

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...(prev[parent as keyof IUser]as object), [child]: value },
      }));
    } else if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        // For boolean fields like hasDiabetes, okuStatus, ensure they are boolean
        if (name === 'hasDiabetes' || name === 'okuStatus') {
            setFormData(prev => ({ ...prev, [name]: value === 'true' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: checked }));
        }
    } else {
      // For heightCm and weightKg, allow empty string to clear, otherwise parse
      if (name === 'heightCm' || name === 'weightKg') {
        setFormData(prev => ({ ...prev, [name]: value ? parseFloat(value) : '' }));
      } else {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => { // This handles text data updates
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setPhotoMessage(null); // Clear photo messages on general save

    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData), // formData already has photoUrl if previously set
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }
      setMessage({ type: 'success', text: 'Profile details updated successfully!' });
      // If name changed and it's part of session, update session
      if (formData.name && (formData.name.first !== session?.user?.name?.split(' ')[0] || formData.name.last !== session?.user?.name?.split(' ')[1])) {
        await updateSession({user: {...session?.user, name: `${formData.name.first} ${formData.name.last}`.trim()}})
      }
      
      // Call the success callback if provided
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  const getNestedValue = (obj: any, path: string) => {
    const keys = path.split('.');
    return keys.reduce((acc, key) => (acc && acc[key] !== 'undefined') ? acc[key] : '', obj);
  }

  if (isFetching) return <p className="text-center py-4">Loading profile form...</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 border-b pb-4">Personal Information</h2>
      
      {/* Profile Picture Section */}
      <div className="col-span-1 md:col-span-2">
        <label htmlFor="photoUploadInput" className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
        <div className="flex items-center space-x-4">
          <div className="shrink-0">
            {(imagePreview || formData.photoUrl) ? (
              <Image 
                src={imagePreview || formData.photoUrl!} 
                alt="Profile" 
                width={96} 
                height={96} 
                className="h-24 w-24 rounded-full object-cover border-2 border-gray-300" 
                priority={!!formData.photoUrl}
                key={formData.photoUrl || imagePreview}
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 border-2 border-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1">
            <label
              htmlFor="photoUploadInput"
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingToCloudinary ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                'Change photo'
              )}
              <input 
                id="photoUploadInput"
                name="photo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileSelectedForUpload}
                disabled={isUploadingToCloudinary || isLoading}
              />
            </label>
            <p className="mt-1 text-xs text-gray-500">Upload a new photo (JPG, PNG, GIF, max 4MB).</p>
            
            {/* Display any photo upload related messages */}
            {photoMessage && (
              <div className={`mt-2 text-sm ${photoMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {photoMessage.text}
                {photoMessage.type === 'error' && photoMessage.text.includes('Unauthorized') && (
                  <button 
                    type="button"
                    onClick={() => window.location.reload()}
                    className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs hover:bg-red-200"
                  >
                    Refresh Page
                  </button>
                )}
              </div>
            )}
            
            {/* Add a more prominent error message for unauthorized errors */}
            {photoMessage && photoMessage.type === 'error' && photoMessage.text.includes('session') && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800">Session Error</p>
                <p className="text-sm text-red-700">
                  Your session appears to have expired. Please try refreshing the page and trying again.
                </p>
                <button 
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-md text-sm font-medium hover:bg-red-200"
                >
                  Refresh Page
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="icPassportNo" className="block text-sm font-medium text-gray-700">IC/Passport Number (no spaces/dashes)</label>
          <input type="text" name="icPassportNo" id="icPassportNo" value={formData.icPassportNo || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="name.first" className="block text-sm font-medium text-gray-700">First Name</label>
          <input type="text" name="name.first" id="name.first" value={getNestedValue(formData, 'name.first')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="name.last" className="block text-sm font-medium text-gray-700">Last Name</label>
          <input type="text" name="name.last" id="name.last" value={getNestedValue(formData, 'name.last')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        {/* Date of Birth Display */}
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input 
            type="date" 
            name="dateOfBirth" 
            id="dateOfBirth" 
            value={formData.dateOfBirth ? formData.dateOfBirth.toString().split('T')[0] : ''} 
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" 
          />
        </div>
        <div>
          <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
          <select name="gender" id="gender" value={formData.gender || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="address.street" className="block text-sm font-medium text-gray-700">Address (Street)</label>
        <input type="text" name="address.street" id="address.street" value={getNestedValue(formData, 'address.street')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="address.city" className="block text-sm font-medium text-gray-700">City</label>
          <input type="text" name="address.city" id="address.city" value={getNestedValue(formData, 'address.city')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="address.state" className="block text-sm font-medium text-gray-700">State</label>
          <input type="text" name="address.state" id="address.state" value={getNestedValue(formData, 'address.state')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="address.postcode" className="block text-sm font-medium text-gray-700">Postcode</label>
          <input type="text" name="address.postcode" id="address.postcode" value={getNestedValue(formData, 'address.postcode')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
      </div>
      
      <div>
        <label htmlFor="address.country" className="block text-sm font-medium text-gray-700">Country</label>
        <input type="text" name="address.country" id="address.country" value={getNestedValue(formData, 'address.country')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number (e.g., +60123456789)</label>
          <input type="tel" name="phone" id="phone" value={formData.phone || ''} onChange={handleChange} placeholder="+CountryCodeNumber" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="maritalStatus" className="block text-sm font-medium text-gray-700">Marital Status</label>
          <select name="maritalStatus" id="maritalStatus" value={formData.maritalStatus || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
            <option value="">Select Status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
          </select>
        </div>
        <div>
          <label htmlFor="race" className="block text-sm font-medium text-gray-700">Race</label>
          <input type="text" name="race" id="race" value={formData.race || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="profession" className="block text-sm font-medium text-gray-700">Profession</label>
          <input type="text" name="profession" id="profession" value={formData.profession || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-gray-700 pt-4 border-t mt-6">Emergency Contact</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="emergencyContact.name" className="block text-sm font-medium text-gray-700">Name</label>
          <input type="text" name="emergencyContact.name" id="emergencyContact.name" value={getNestedValue(formData, 'emergencyContact.name')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="emergencyContact.relationship" className="block text-sm font-medium text-gray-700">Relationship</label>
          <input type="text" name="emergencyContact.relationship" id="emergencyContact.relationship" value={getNestedValue(formData, 'emergencyContact.relationship')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="emergencyContact.phone" className="block text-sm font-medium text-gray-700">Phone (e.g., +60123456789)</label>
          <input type="tel" name="emergencyContact.phone" id="emergencyContact.phone" value={getNestedValue(formData, 'emergencyContact.phone')} onChange={handleChange} placeholder="+CountryCodeNumber" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-gray-800 border-b pt-8 pb-4">Medical Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="heightCm" className="block text-sm font-medium text-gray-700">Height (cm)</label>
          <input type="number" name="heightCm" id="heightCm" value={formData.heightCm || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="weightKg" className="block text-sm font-medium text-gray-700">Weight (kg)</label>
          <input type="number" name="weightKg" id="weightKg" value={formData.weightKg || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="bloodType" className="block text-sm font-medium text-gray-700">Blood Type</label>
          <input type="text" name="bloodType" id="bloodType" value={formData.bloodType || ''} onChange={handleChange} placeholder="e.g., A+, O-" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="okuStatus" className="block text-sm font-medium text-gray-700">Status OKU</label>
          <select name="okuStatus" id="okuStatus" value={formData.okuStatus === undefined ? '' : String(formData.okuStatus)} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
            <option value="">Select</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="allergies" className="block text-sm font-medium text-gray-700">Allergies (comma-separated)</label>
        <input type="text" name="allergies" id="allergies" value={Array.isArray(formData.allergies) ? formData.allergies.join(', ') : ''} onChange={(e) => setFormData(prev => ({...prev, allergies: e.target.value.split(',').map(s => s.trim()).filter(s => s)}))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      
      <div>
        <label htmlFor="vaccinationHistory_simple" className="block text-sm font-medium text-gray-700">Vaccination History (Summary)</label>
        <textarea name="vaccinationHistory_simple" id="vaccinationHistory_simple" rows={3} placeholder="e.g., MMR - 2000, COVID-19 Pfizer - 2021, 2022" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"></textarea>
        <p className="text-xs text-gray-500 mt-1">Detailed vaccination history is a complex field; this is a simplified summary for now.</p>
      </div>
      
      <div>
        <label htmlFor="currentMedications_simple" className="block text-sm font-medium text-gray-700">Current Medications (Summary)</label>
        <textarea name="currentMedications_simple" id="currentMedications_simple" rows={3} placeholder="e.g., Metformin 500mg - daily, Aspirin 75mg - daily" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"></textarea>
        <p className="text-xs text-gray-500 mt-1">Detailed medication list is a complex field; this is a simplified summary for now.</p>
      </div>

      <h3 className="text-xl font-semibold text-gray-700 pt-4 border-t mt-6">Insurance Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="insurance.certificateNo" className="block text-sm font-medium text-gray-700">Insurance Medical Certificate No.</label>
          <input type="text" name="insurance.certificateNo" id="insurance.certificateNo" value={getNestedValue(formData, 'insurance.certificateNo')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="insurance.company" className="block text-sm font-medium text-gray-700">Insurance Company</label>
          <input type="text" name="insurance.company" id="insurance.company" value={getNestedValue(formData, 'insurance.company')} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
      </div>
      
      <div>
        <label htmlFor="hasDiabetes" className="block text-sm font-medium text-gray-700">Do you have Diabetes?</label>
        <select name="hasDiabetes" id="hasDiabetes" value={formData.hasDiabetes === undefined ? '' : String(formData.hasDiabetes)} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
          <option value="">Select</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="pt-5">
        <button 
          type="submit" 
          disabled={isLoading || isUploadingToCloudinary}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? 'Saving Profile...' : (isUploadingToCloudinary ? 'Processing Image...' : 'Save Profile')}
        </button>
      </div>
    </form>
  );
};

export default UserProfileForm; 