import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import Logo from 'logo.png';
import { IUser } from '@/models/User';

// Ensure CLOUDINARY_CLOUD_NAME is in your .env.local and exposed to the client if needed
// For direct client-side uploads, an upload preset is typically used.
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET; // e.g., 'cleard_user_photos'

type UserFormData = Partial<{
  [K in keyof IUser]: IUser[K] extends object ? Partial<IUser[K]> : IUser[K];
}> & { confirmPassword?: string };

const RegisterPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<UserFormData>({});
  const [isLoading, setIsLoading] = useState(false); // For main form submission
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // const [selectedFile, setSelectedFile] = useState<File | null>(null); // No longer sending file to backend
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [uploadedPhotoPublicId, setUploadedPhotoPublicId] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');

  const handleFileChangeAndUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      setError("Cloudinary environment variables not configured correctly. Please contact support.");
      console.error("Missing Cloudinary config: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET");
      return;
    }
    setError(null); // Clear general errors
    setUploadedPhotoUrl(null); // Clear previous upload results
    setUploadedPhotoPublicId(null);

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Client-side validation (optional but good UX)
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file.');
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        e.target.value = '';
        return;
      }
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        setError('File is too large (max 4MB).');
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        e.target.value = '';
        return;
      }

      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(URL.createObjectURL(file));
      setIsUploadingImage(true);

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      // Add other parameters like folder if needed, configured in your upload preset or here
      // uploadFormData.append('folder', 'user_profile_pics');

      try {
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: 'POST',
            body: uploadFormData,
          }
        );
        const data = await response.json();
        if (data.secure_url && data.public_id) {
          setUploadedPhotoUrl(data.secure_url);
          setUploadedPhotoPublicId(data.public_id);
          setError(null); // Clear any previous file errors
        } else {
          console.error('Cloudinary upload failed:', data);
          setError(data.error?.message || 'Cloudinary upload failed. Please try again.');
          if (imagePreview) URL.revokeObjectURL(imagePreview);
          setImagePreview(null); // Clear preview on error
        }
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        setError('Image upload failed. Please check your connection and try again.');
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null); // Clear preview on error
      } finally {
        setIsUploadingImage(false);
      }
    } else {
      // No file selected or files array is empty
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setUploadedPhotoUrl(null);
      setUploadedPhotoPublicId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...(prev[parent as keyof IUser] as object), [child]: value },
      }));
    } else if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value ? parseFloat(value) : undefined }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const getNestedValue = (path: string) => {
    const keys = path.split('.');
    let current: any = formData;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return '';
      }
    }
    return current === undefined || current === null ? '' : String(current);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!uploadedPhotoUrl || !uploadedPhotoPublicId) {
      setError('Profile picture must be uploaded first.');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    const { confirmPassword, ...submissionDataRest } = formData;
    
    const registrationPayload = {
        ...submissionDataRest,
        dateOfBirth,
        photoUrl: uploadedPhotoUrl,
        photoPublicId: uploadedPhotoPublicId,
    };
    // Nested objects like name, address, etc., are already structured in formData
    // by the handleChange function, so they should be fine in submissionDataRest.

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // Sending JSON now
        body: JSON.stringify(registrationPayload), 
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Error: ${res.status}`);
      }
      setSuccess('Registration successful! Redirecting to login...');
      setFormData({});
      // setSelectedFile(null); // Not used anymore
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setUploadedPhotoUrl(null);
      setUploadedPhotoPublicId(null);
      // Reset the file input
      const fileInput = document.getElementById('photo') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBaseClass = "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm transition duration-150 ease-in-out";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const sectionTitleClass = "text-xl font-semibold text-gray-800 border-b pb-2 mb-4 mt-6";
  const fieldGroupClass = "mb-4";

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-y-auto bg-gradient-to-br from-slate-100 via-gray-100 to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="relative sm:mx-auto sm:w-full sm:max-w-2xl space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-200/50 my-12">
        <div className="text-center">
          <Image 
            src={Logo} 
            alt="CLEAR-D Logo" 
            width={200} 
            height={80} 
            className="mx-auto mb-4" 
            priority 
          />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Create your CLEAR-D Account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-purple-600 hover:text-purple-500 hover:underline ml-1 transition duration-150 ease-in-out">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm flex items-center space-x-2" role="alert">
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-md text-sm" role="alert">
              <span>{success}</span>
            </div>
          )}
          
          {/* Account Details */}
          <section>
            <h3 className={sectionTitleClass}>Account Details</h3>
            <div className={fieldGroupClass}>
              <label htmlFor="email" className={labelClass}>Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" required value={formData.email || ''} onChange={handleChange} className={inputBaseClass} />
            </div>
            <div className={fieldGroupClass}>
              <label htmlFor="password" className={labelClass}>Password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required value={formData.password || ''} onChange={handleChange} className={inputBaseClass} placeholder="Min. 6 characters"/>
            </div>
            <div className={fieldGroupClass}>
              <label htmlFor="confirmPassword" className={labelClass}>Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required value={formData.confirmPassword || ''} onChange={handleChange} className={`${inputBaseClass} ${formData.password !== formData.confirmPassword && formData.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`} />
              {formData.password !== formData.confirmPassword && formData.confirmPassword && (
                <p className="text-red-600 text-xs mt-1">Passwords do not match.</p>
              )}
            </div>
          </section>

          {/* Personal Information */}
          <section>
            <h3 className={sectionTitleClass}>Personal Information</h3>
            <div className={fieldGroupClass}>
                <label htmlFor="photo" className={labelClass}>Profile Picture (Required)</label>
                <input 
                    id="photo" 
                    name="photo" 
                    type="file" 
                    required 
                    accept="image/*" 
                    onChange={handleFileChangeAndUpload}
                    className={`${inputBaseClass} file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100`}
                    disabled={isUploadingImage}
                />
                {isUploadingImage && <p className="text-sm text-purple-600 mt-2">Uploading image...</p>}
                {imagePreview && !isUploadingImage && uploadedPhotoUrl && (
                     <p className="text-sm text-green-600 mt-2">Image uploaded successfully!</p>
                )}
                {imagePreview && (
                    <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">Image Preview:</p>
                        <Image src={imagePreview} alt="Profile Preview" width={150} height={150} className="rounded-md object-cover border border-gray-300" />
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className={fieldGroupClass}>
                <label htmlFor="icPassportNo" className={labelClass}>IC/Passport Number</label>
                <input type="text" name="icPassportNo" id="icPassportNo" value={formData.icPassportNo || ''} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="name.first" className={labelClass}>First Name</label>
                <input type="text" name="name.first" id="name.first" value={getNestedValue('name.first')} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="name.last" className={labelClass}>Last Name</label>
                <input type="text" name="name.last" id="name.last" value={getNestedValue('name.last')} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="gender" className={labelClass}>Gender</label>
                <select name="gender" id="gender" value={formData.gender || ''} onChange={handleChange} className={inputBaseClass}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className={fieldGroupClass}>
              <label htmlFor="address.street" className={labelClass}>Address (Street)</label>
              <input type="text" name="address.street" id="address.street" value={getNestedValue('address.street')} onChange={handleChange} className={inputBaseClass} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6">
              <div className={fieldGroupClass}>
                <label htmlFor="address.city" className={labelClass}>City</label>
                <input type="text" name="address.city" id="address.city" value={getNestedValue('address.city')} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="address.state" className={labelClass}>State</label>
                <input type="text" name="address.state" id="address.state" value={getNestedValue('address.state')} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="address.postcode" className={labelClass}>Postcode</label>
                <input type="text" name="address.postcode" id="address.postcode" value={getNestedValue('address.postcode')} onChange={handleChange} className={inputBaseClass} />
              </div>
            </div>
            <div className={fieldGroupClass}>
              <label htmlFor="address.country" className={labelClass}>Country</label>
              <input type="text" name="address.country" id="address.country" value={getNestedValue('address.country')} onChange={handleChange} className={inputBaseClass} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className={fieldGroupClass}>
                <label htmlFor="phone" className={labelClass}>Phone Number</label>
                <input type="tel" name="phone" id="phone" value={formData.phone || ''} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="maritalStatus" className={labelClass}>Marital Status</label>
                <select name="maritalStatus" id="maritalStatus" value={formData.maritalStatus || ''} onChange={handleChange} className={inputBaseClass}>
                  <option value="">Select Status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="race" className={labelClass}>Race</label>
                <input type="text" name="race" id="race" value={formData.race || ''} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="profession" className={labelClass}>Profession</label>
                <input type="text" name="profession" id="profession" value={formData.profession || ''} onChange={handleChange} className={inputBaseClass} />
              </div>
            </div>
          </section>

          {/* Emergency Contact */}
          <section>
            <h3 className={sectionTitleClass}>Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6">
              <div className={fieldGroupClass}>
                <label htmlFor="emergencyContact.name" className={labelClass}>Name</label>
                <input type="text" name="emergencyContact.name" id="emergencyContact.name" value={getNestedValue('emergencyContact.name')} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="emergencyContact.relationship" className={labelClass}>Relationship</label>
                <input type="text" name="emergencyContact.relationship" id="emergencyContact.relationship" value={getNestedValue('emergencyContact.relationship')} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="emergencyContact.phone" className={labelClass}>Phone</label>
                <input type="tel" name="emergencyContact.phone" id="emergencyContact.phone" value={getNestedValue('emergencyContact.phone')} onChange={handleChange} className={inputBaseClass} />
              </div>
            </div>
          </section>

          {/* Medical Information */}
          <section>
            <h3 className={sectionTitleClass}>Medical Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className={fieldGroupClass}>
                <label htmlFor="heightCm" className={labelClass}>Height (cm)</label>
                <input type="number" name="heightCm" id="heightCm" value={formData.heightCm || ''} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="weightKg" className={labelClass}>Weight (kg)</label>
                <input type="number" name="weightKg" id="weightKg" value={formData.weightKg || ''} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="bloodType" className={labelClass}>Blood Type (e.g., A+)</label>
                <input type="text" name="bloodType" id="bloodType" value={formData.bloodType || ''} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="okuStatus" className={labelClass}>OKU Status</label>
                <select name="okuStatus" id="okuStatus" value={formData.okuStatus === undefined ? '' : String(formData.okuStatus)} onChange={handleChange} className={inputBaseClass}>
                  <option value="">Select</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="hasDiabetes" className={labelClass}>Do you have Diabetes?</label>
                <select name="hasDiabetes" id="hasDiabetes" value={formData.hasDiabetes === undefined ? '' : String(formData.hasDiabetes)} onChange={handleChange} className={inputBaseClass}>
                  <option value="">Select</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
            <div className={fieldGroupClass}>
              <label htmlFor="allergies" className={labelClass}>Allergies (comma-separated)</label>
              <input type="text" name="allergies" id="allergies" placeholder="e.g., penicillin, dust, peanuts" value={(formData.allergies as string[] || []).join(', ')} onChange={(e) => setFormData(prev => ({...prev, allergies: e.target.value.split(',').map(s => s.trim()).filter(s => s)}))} className={inputBaseClass} />
            </div>
            <div className={fieldGroupClass}>
              <label htmlFor="vaccinationHistory_simple" className={labelClass}>Vaccination History (Summary)</label>
              <textarea name="vaccinationHistory_simple" id="vaccinationHistory_simple" rows={2} placeholder="e.g., COVID-19 - 2023, Flu - 2022" className={inputBaseClass} onChange={handleChange} />
            </div>
            <div className={fieldGroupClass}>
              <label htmlFor="currentMedications_simple" className={labelClass}>Current Medications (Summary)</label>
              <textarea name="currentMedications_simple" id="currentMedications_simple" rows={2} placeholder="e.g., Metformin 500mg, Aspirin 75mg" className={inputBaseClass} onChange={handleChange} />
            </div>
          </section>

          {/* Insurance Information */}
          <section>
            <h3 className={sectionTitleClass}>Insurance Information (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className={fieldGroupClass}>
                <label htmlFor="insurance.certificateNo" className={labelClass}>Insurance Medical Certificate No.</label>
                <input type="text" name="insurance.certificateNo" id="insurance.certificateNo" value={getNestedValue('insurance.certificateNo')} onChange={handleChange} className={inputBaseClass} />
              </div>
              <div className={fieldGroupClass}>
                <label htmlFor="insurance.company" className={labelClass}>Insurance Company</label>
                <input type="text" name="insurance.company" id="insurance.company" value={getNestedValue('insurance.company')} onChange={handleChange} className={inputBaseClass} />
              </div>
            </div>
          </section>

          {/* Date of Birth Field */}
          <div>
            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">Date of Birth</label>
            <input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-70 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Registering...
                </>
              ) : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage; 