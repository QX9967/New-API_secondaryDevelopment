"""测试代理服务器"""

from openai import OpenAI

def test_non_stream():
    """测试非流式请求"""
    print("=" * 50)
    print("Test: Non-stream request")
    print("=" * 50)
    
    client = OpenAI(
        api_key="any-key",
        base_url="http://localhost:8080/v1"
    )
    
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Say hello in one word"}]
    )
    
    print(f"Model: {response.model}")
    print(f"Response: {response.choices[0].message.content}")
    print(f"Usage: {response.usage}")
    print()


def test_stream():
    """测试流式请求"""
    print("=" * 50)
    print("Test: Stream request")
    print("=" * 50)
    
    client = OpenAI(
        api_key="any-key",
        base_url="http://localhost:8080/v1"
    )
    
    stream = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Count from 1 to 5"}],
        stream=True
    )
    
    print("Response: ", end="")
    for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)
    print("\n")


def test_models():
    """测试模型列表"""
    print("=" * 50)
    print("Test: List models")
    print("=" * 50)
    
    client = OpenAI(
        api_key="any-key",
        base_url="http://localhost:8080/v1"
    )
    
    models = client.models.list()
    for model in models.data[:5]:
        print(f"  - {model.id}")
    print()


if __name__ == "__main__":
    try:
        test_models()
        test_non_stream()
        test_stream()
        print("=" * 50)
        print("All tests passed!")
        print("=" * 50)
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure the server is running: python main.py")
