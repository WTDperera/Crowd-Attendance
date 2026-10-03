import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

// Compatibility export: update an Admin-provisioned profile's presentation.
// This client function cannot create a profile or assign a role.
export const createLecturerProfile = async (uid, data) => {
  const lecturerRef = doc(db, "lecturers", uid);
  const payload = {
    fullName: data.fullName,
    department: data.department ?? "",
  };

  await updateDoc(lecturerRef, payload);
};
