import { NextRequest, NextResponse } from 'next/server';
import { UTApi } from 'uploadthing/server';

const utapi = new UTApi();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    // Subir archivo a UploadThing
    const response = await utapi.uploadFiles(file);

    if (!response.data) {
      throw new Error('Error al subir archivo');
    }

    return NextResponse.json({
      success: true,
      url: response.data.url,
      key: response.data.key,
      name: response.data.name,
      size: response.data.size
    });

  } catch (error) {
    console.error('Error al subir PDF:', error);
    return NextResponse.json(
      { 
        error: 'Error al subir el archivo',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}