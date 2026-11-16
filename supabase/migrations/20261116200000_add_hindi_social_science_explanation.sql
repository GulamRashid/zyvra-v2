-- Add the missing Hindi explanation for the NCERT Social Science introduction question.
UPDATE public.questions
SET explanation_hi = 'परिचय में बताया गया है कि यह जानबूझकर किया गया है: लेखक विभिन्न क्षेत्रों के तत्वों को एक साथ लाने में विश्वास करते हैं, जिसे बहु-विषयक दृष्टिकोण कहते हैं। इससे हमारी समझ और दृष्टिकोण समृद्ध होता है, क्योंकि जीवन में भी कई तरह के तत्व लगातार आपस में जुड़े रहते हैं। अन्य विकल्प पाठ के विपरीत हैं; पुस्तक उप-विषयों के कठोर वर्गीकरण से बचती है और बताती है कि सामाजिक विज्ञान की प्रक्रियाएँ निश्चित नहीं होतीं।',
    updated_at = now()
WHERE id = '27c14ba8-f739-4e43-b446-d124eac8de32'
  AND nullif(btrim(coalesce(explanation_hi, '')), '') IS NULL;
