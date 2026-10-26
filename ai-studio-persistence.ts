// @ts-nocheck

export interface AiGenerationItem {
  id: string;
  timestamp: string;
  prompt: string;
  aspectRatio: string;
  imageUrl: string;
  storagePath?: string;
  category: string;
  modelUsed: string;
  publishedToGallery?: boolean;
}

/**
 * Persists an AI-generated base64 image into Supabase Storage ('gallery' bucket)
 * and records it into `gallery_images` and `dashboard_records.aiGenerations`.
 */
export async function persistAiRenderToGallery(
  supabase: any,
  options: {
    imageBase64OrUrl: string;
    title: string;
    prompt: string;
    category?: string;
    aspectRatio?: string;
    modelUsed?: string;
    showOnModularKitchen?: boolean;
    showOnHomepage?: boolean;
    showInPackages?: boolean;
    packageTag?: string;
  }
): Promise<{ success: boolean; publicUrl?: string; storagePath?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized.' };
  }

  try {
    const { imageBase64OrUrl, title, prompt, category = 'kitchen', aspectRatio = '16:9', modelUsed = 'gemini-3.1-flash-image' } = options;

    let blob: Blob;
    if (imageBase64OrUrl.startsWith('data:')) {
      const res = await fetch(imageBase64OrUrl);
      blob = await res.blob();
    } else {
      const res = await fetch(imageBase64OrUrl);
      blob = await res.blob();
    }

    const cleanName = (title || 'ai-render').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const storagePath = `ai_renders/${Date.now()}_${cleanName}.png`;

    // 1. Upload to Supabase Storage 'gallery' bucket
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('gallery')
      .upload(storagePath, blob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadErr) {
      console.warn('Storage upload notice:', uploadErr.message);
      // Fallback: If storage upload fails due to RLS, try server upload endpoint
      try {
        const sRes = await fetch('/api/ai/image/persist-to-storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageBase64OrUrl,
            title,
            prompt,
            category,
            placements: {
              showOnModularKitchen: options.showOnModularKitchen ?? true,
              showOnHomepage: options.showOnHomepage ?? true,
              showInPackages: options.showInPackages ?? false,
            },
          }),
        });
        if (sRes.ok) {
          const sJson = await sRes.json();
          if (sJson.success) {
            return { success: true, publicUrl: sJson.publicUrl, storagePath: sJson.storagePath };
          }
        }
      } catch {}
      return { success: false, error: uploadErr.message };
    }

    // 2. Get Public URL
    const { data: pubData } = supabase.storage.from('gallery').getPublicUrl(storagePath);
    const publicUrl = pubData?.publicUrl || imageBase64OrUrl;

    // 3. Save into gallery_images table
    const galleryRecordId = `gal_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const captionObj = {
      cleanCaption: prompt ? `AI 3D Concept: ${prompt.slice(0, 100)}...` : 'AI Generated 3D Render',
      published: true,
      displayLocation: 'both',
      showOnHomepage: options.showOnHomepage ?? true,
      showOnModularKitchen: options.showOnModularKitchen ?? true,
      showInPortfolio: true,
      showInHero: false,
      showInPackages: options.showInPackages ?? false,
      package: options.packageTag || 'none',
      displayOrder: 99,
    };

    try {
      await supabase.from('gallery_images').insert([{
        id: galleryRecordId,
        title: title || 'Luxury Modular Kitchen 3D Render',
        category: category || 'kitchen',
        url: publicUrl,
        storage_path: storagePath,
        caption: JSON.stringify(captionObj),
      }]);
    } catch (gErr) {
      console.warn('Gallery insert notice:', gErr);
    }

    // 4. Save into AI generations history
    await saveAiGenerationHistory(supabase, {
      id: `ai_gen_${Date.now()}`,
      timestamp: new Date().toISOString(),
      prompt,
      aspectRatio,
      imageUrl: publicUrl,
      storagePath,
      category,
      modelUsed,
      publishedToGallery: true,
    });

    return { success: true, publicUrl, storagePath };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to persist render to Supabase Storage' };
  }
}

/**
 * Saves an AI generation item to Supabase history
 */
export async function saveAiGenerationHistory(supabase: any, item: AiGenerationItem) {
  if (!supabase) return;

  try {
    // 1. Try dedicated table if available
    try {
      await supabase.from('ai_generations').insert([{
        id: item.id,
        prompt: item.prompt,
        aspect_ratio: item.aspectRatio,
        image_url: item.imageUrl,
        storage_path: item.storagePath || null,
        category: item.category,
        model_used: item.modelUsed,
        published_to_gallery: item.publishedToGallery || false,
      }]);
    } catch {}

    // 2. Dual-save to site_content.dashboard_records.aiGenerations
    const { data: rec } = await supabase
      .from('site_content')
      .select('data')
      .eq('id', 'dashboard_records')
      .maybeSingle();

    const currentData = rec?.data || {};
    const existingList: AiGenerationItem[] = Array.isArray(currentData.aiGenerations) ? currentData.aiGenerations : [];
    existingList.unshift(item);
    const trimmed = existingList.slice(0, 100);

    await supabase
      .from('site_content')
      .update({
        data: { ...currentData, aiGenerations: trimmed },
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'dashboard_records');
  } catch (err) {
    console.warn('AI history save notice:', err);
  }
}

/**
 * Loads AI generation history from Supabase
 */
export async function fetchAiGenerations(supabase: any): Promise<AiGenerationItem[]> {
  if (!supabase) return [];

  try {
    // 1. Try dedicated table
    const { data: rows, error } = await supabase
      .from('ai_generations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && Array.isArray(rows) && rows.length > 0) {
      return rows.map(r => ({
        id: r.id,
        timestamp: r.created_at || new Date().toISOString(),
        prompt: r.prompt,
        aspectRatio: r.aspect_ratio || '16:9',
        imageUrl: r.image_url,
        storagePath: r.storage_path,
        category: r.category || 'kitchen',
        modelUsed: r.model_used || 'Gemini 3.1 Flash Image',
        publishedToGallery: r.published_to_gallery,
      }));
    }
  } catch {}

  // 2. Try site_content.dashboard_records.aiGenerations
  try {
    const { data: rec } = await supabase
      .from('site_content')
      .select('data')
      .eq('id', 'dashboard_records')
      .maybeSingle();

    if (rec?.data?.aiGenerations && Array.isArray(rec.data.aiGenerations)) {
      return rec.data.aiGenerations;
    }
  } catch {}

  return [];
}
