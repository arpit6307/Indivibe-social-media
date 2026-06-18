import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { file, folder = 'indivibe' } = await request.json(); // Base64 file

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn("Cloudinary configuration missing in .env.local. Falling back to local data URL.");
      return NextResponse.json({ 
        success: false, 
        message: "Cloudinary config missing",
        fallbackUrl: file // Return base64 back as fallback
      });
    }

    // Cloudinary upload parameters
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    
    // Generate signature
    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    // Prepare upload payload
    const formData = new URLSearchParams();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('timestamp', timestamp);
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json();

    if (data.error) {
      console.error("Cloudinary upload error response:", data.error);
      return NextResponse.json({ 
        success: false, 
        error: data.error.message, 
        fallbackUrl: file 
      });
    }

    return NextResponse.json({
      success: true,
      secure_url: data.secure_url,
      public_id: data.public_id
    });
  } catch (err: any) {
    console.error("Cloudinary API Route error:", err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
