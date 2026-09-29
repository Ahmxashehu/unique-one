export type EducationInstitutionType = 'school' | 'university' | 'college' | 'training_center' | 'tutor' | 'online';
export type EducationInstitutionStatus = 'draft' | 'published' | 'suspended';
export type EducationEnrollmentStatus = 'active' | 'completed' | 'withdrawn';
export type EducationCourseStatus = 'draft' | 'published' | 'archived';

export interface EducationInstitution {
  id: string;
  ownerUid: string;
  name: string;
  type: EducationInstitutionType;
  location: string;
  description?: string;
  status: EducationInstitutionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EducationEnrollment {
  id: string;
  studentUid: string;
  institutionId: string;
  courseId?: string;
  programme?: string;
  level?: string;
  status: EducationEnrollmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EducationCourse {
  id: string;
  institutionId: string;
  ownerUid: string;
  title: string;
  description?: string;
  level?: string;
  status: EducationCourseStatus;
  createdAt: string;
  updatedAt: string;
}