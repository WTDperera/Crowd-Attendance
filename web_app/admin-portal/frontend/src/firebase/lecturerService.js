import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const createLecturerProfile = async (uid, data) => {
  const lecturerRef = doc(db, "lecturers", uid);
  const payload = {
    fullName: data.fullName,
    email: data.email,
    department: data.department ?? "",
    role: "lecturer",
    createdAt: serverTimestamp(),
  };

  await setDoc(lecturerRef, payload, { merge: true });
};
