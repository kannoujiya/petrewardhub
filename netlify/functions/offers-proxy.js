exports.handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  const { s1: uid, s2: country } = event.queryStringParameters;
  
  console.log('Offers proxy request:', { uid, country });

  try {
    // AdBlue feed URL with provided credentials
    const userId = '481160';
    const apiKey = '89a09f95e53dde3a5e593491e1134540';
    const feedUrl = `https://d1y3y09sav47f5.cloudfront.net/public/offers/feed.php?user_id=${userId}&api_key=${apiKey}&s1=${uid}&s2=${country || ''}`;
    
    console.log('Fetching from AdBlue feed:', feedUrl);
    
    const response = await fetch(feedUrl);
    
    if (!response.ok) {
      throw new Error(`Feed responded with status: ${response.status}`);
    }

    let data = await response.text();
    
    // If it's JSONP, strip the callback wrapper
    if (data.startsWith('callback(')) {
      data = data.substring(9, data.length - 2);
    } else if (data.startsWith('jsonp(')) {
      data = data.substring(6, data.length - 2);
    }
    
    const offers = JSON.parse(data);

    // Process offers to add coin estimates
    const processedOffers = offers.slice(0, 9).map(offer => ({
      ...offer,
      estimatedCoins: offer.payout < 1.5 ? '10 coins' : '20 coins',
      coins: offer.payout < 1.5 ? 10 : 20
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(processedOffers)
    };

  } catch (error) {
    console.error('Offers proxy error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch offers',
        details: error.message 
      })
    };
  }
};