import axios from "axios";

// Para frontend, usar valores directos ya que las variables de entorno necesitan prefijo VITE_
export const apiUrl = import.meta.env.VITE_API_POKT || "https://api.poktscan.com/poktscan/api/graphql";
export const authToken = import.meta.env.VITE_TOKEN_POKT || "461fc459-6254-443c-939a-a84da4f495fb";

export const fetchData = async (query: string) => {
  console.log('🔍 fetchData - Using API URL:', apiUrl);
  console.log('🔑 fetchData - Using auth token:', authToken ? 'Present' : 'Missing');

  const requestOptions = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authToken,
      'Cache-Control': 'public, max-age=600',
    },
  };

  try {
    const response = await axios.post(apiUrl, { query }, requestOptions);
    console.log('✅ fetchData - Response received:', response.status);
    return response.data.data;
  } catch (error) {
    console.error("❌ fetchData - Error details:", {
      message: (error as any).message,
      status: (error as any).response?.status,
      url: apiUrl,
      hasAuth: !!authToken
    });
    throw error;
  }
};
